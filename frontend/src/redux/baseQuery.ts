import { fetchBaseQuery } from '@reduxjs/toolkit/query';
import { Logout } from './slices/authSlice';
import { BACKEND_BASE_URL } from '../constants';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: BACKEND_BASE_URL,
  credentials: 'include',
});

export const baseQueryWithReauth: typeof rawBaseQuery = async (
  args,
  api,
  extraOptions,
) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    //attempt refresh
    const refreshResult = await rawBaseQuery(
      {
        url: '/auth/refresh',
        method: 'post',
      },
      api,
      extraOptions,
    );

    if (refreshResult.data) {
      //retry original query
      //because a new access token has being given to you
      result = await rawBaseQuery(args, api, extraOptions);
    } else {
      //refresh failed, force logout
      api.dispatch(Logout());
    }
  }
  return result;
};
