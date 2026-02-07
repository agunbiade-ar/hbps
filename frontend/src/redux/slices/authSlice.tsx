import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';
import { BACKEND_BASE_URL } from '../../constants';
import type { User } from '../../constants';
import axios from 'axios';

export type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
};

const initialState: AuthState = {
  loading: false,
  isAuthenticated: false,
  user: null,
};

export const SignIn = createAsyncThunk(
  `auth/login`,
  async (
    body: { username: string; password: string },
    { dispatch, rejectWithValue },
  ) => {
    try {
      const formData = new URLSearchParams();

      formData.append('username', body.username);
      formData.append('password', body.password);

      await axios.post(`${BACKEND_BASE_URL}/auth/login`, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        withCredentials: true, //required for cookies, you remember you're setting the httpOnly cookie for your tokens
      });
      return true;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // Backend responded
          return rejectWithValue(
            error.response.data?.detail || 'Invalid credentials',
          );
        } else if (error.request) {
          // Request made, no response
          return rejectWithValue(
            'Cannot reach server. Please try again later.',
          );
        }
      }
      return rejectWithValue('Unexpected error occurred');
    }
  },
);

export const FetchMe = createAsyncThunk<User>(
  'auth/fetchMe',
  async (_, { rejectWithValue }) => {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/auth/me`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('User not authenticated');
      }
      const user = await res.json();
      return user;
    } catch {
      return rejectWithValue(null);
    }
  },
);

export const Logout = createAsyncThunk<void>(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/auth/logout`, {
        credentials: 'include',
        method: 'post',
      });
      if (!res.ok) {
        throw new Error('Logout failed');
      }
      return;
    } catch {
      return rejectWithValue(null);
    }
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    reset(state) {
      state = initialState;
      return state;
    },
    setUser: (state, action: PayloadAction<User>) => {
      return {
        ...state,
        user: action.payload,
      };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(FetchMe.pending, (state) => {
        state.loading = true;
      })
      .addCase(FetchMe.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isAuthenticated = true;
        state.loading = false;
      })
      .addCase(FetchMe.rejected, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.loading = false;
      })
      .addCase(Logout.fulfilled, (state) => {
        state.user = null;
      });
  },
});

export const { reset, setUser } = authSlice.actions;
export default authSlice.reducer;
