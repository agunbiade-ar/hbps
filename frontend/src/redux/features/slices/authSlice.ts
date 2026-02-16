import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';
import type { User } from '../../../constants';
import { axios_api } from '../../../api/axios';
import axios from 'axios';

export type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null; // Added for better error tracking
};

const initialState: AuthState = {
  loading: true,
  isAuthenticated: false,
  user: null,
  error: null,
};

export const SignIn = createAsyncThunk(
  'auth/login',
  async (
    body: { username: string; password: string },
    { rejectWithValue, dispatch },
  ) => {
    try {
      const formData = new URLSearchParams();
      formData.append('username', body.username);
      formData.append('password', body.password);

      // Fixed: Use parentheses, remove BACKEND_BASE_URL (already in baseURL)
      await axios_api.post('/auth/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        // Removed withCredentials - already in axios_api config
      });

      // Fetch user data after successful login
      const user = await dispatch(FetchMe()).unwrap();
      return user;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          return rejectWithValue(
            error.response.data?.detail ?? 'Login failed!',
          );
        }
        if (error.request) {
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
      const res = await axios_api.get('/auth/me');
      return res.data;
    } catch (err: any) {
      // Better error handling
      if (axios.isAxiosError(err)) {
        return rejectWithValue(err.response?.data?.detail ?? 'Session expired');
      }
      return rejectWithValue('Failed to fetch user data');
    }
  },
);

export const Logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue, dispatch }) => {
    try {
      await axios_api.post('/auth/logout');
      // Manually reset state after successful logout
      dispatch(reset());
    } catch (error: any) {
      console.error('Logout API failed:', error);
      // Still reset state even if API call fails
      dispatch(reset());
      return rejectWithValue('Logout failed');
    }
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    reset: () => initialState,
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.loading = false;
      state.error = null;
    },
    // Added: Clear error manually if needed
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // SignIn cases
      .addCase(SignIn.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(SignIn.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(SignIn.rejected, (state, action) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.error = action.payload as string;
      })

      // FetchMe cases
      .addCase(FetchMe.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(FetchMe.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isAuthenticated = true;
        state.loading = false;
        state.error = null;
      })
      .addCase(FetchMe.rejected, (state, action) => {
        state.user = null;
        state.isAuthenticated = false;
        state.loading = false;
        state.error = action.payload as string;
      })

      .addCase(Logout.pending, (state) => {
        state.loading = true;
      })
      .addCase(Logout.fulfilled, () => {
        // Return to initial state
        return initialState;
      })
      .addCase(Logout.rejected, () => {
        // Even if logout API fails, clear local state
        return initialState;
      });
  },
});

export const { reset, setUser, clearError } = authSlice.actions;
export default authSlice.reducer;
