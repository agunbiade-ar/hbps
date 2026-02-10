import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';
import { BACKEND_BASE_URL } from '../../../constants';
import type { User } from '../../../constants';
import { axios_api } from '../../../api/axios';
import axios from 'axios';

export type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
};

const initialState: AuthState = {
  loading: true,
  isAuthenticated: false,
  user: null,
};

export const SignIn = createAsyncThunk(
  `auth/login`,
  async (body: { username: string; password: string }, { rejectWithValue, dispatch }) => {
    try {
      const formData = new URLSearchParams();

      formData.append('username', body.username);
      formData.append('password', body.password);

      await axios_api.post(`${BACKEND_BASE_URL}/auth/login`, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        withCredentials: true, //required for cookies, you remember you're setting the httpOnly cookie for your tokens
      });
      const user = await dispatch(FetchMe()).unwrap();
      return user
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
    } catch (err) {
      // console.log(err)
      return rejectWithValue('Session expired');
    }
  },
);

export const Logout = createAsyncThunk('auth/logout', async () => {
  await axios_api.post('/auth/logout');

});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    reset: () => initialState,
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(SignIn.pending, (state) => {
        state.loading = true;
      })
      .addCase(SignIn.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(SignIn.rejected, (state) => {
        state.loading = false;
        state.isAuthenticated = false;
      })
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
      .addMatcher( action => action.type === Logout.fulfilled.type, () => initialState)
  },
});

export const { reset, setUser } = authSlice.actions;
export default authSlice.reducer;
