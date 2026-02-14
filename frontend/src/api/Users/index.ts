import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from '../../redux/baseQuery.ts';

export const users_api = createApi({
  reducerPath: 'users',
  tagTypes: ['users'],
  baseQuery: baseQueryWithReauth,
  endpoints: (builder) => ({
    getAllUsers: builder.query({
      query: (args) => {
        const params: Record<string, any> = {};
        params.limit = args.limit;
        params.offset = args.offset;
        return {
          url: '/auth/users',
          params,
        };
      },
      transformResponse: (response) => response,
      providesTags: (result) =>
        result?.users
          ? [
              { type: 'users', id: 'LIST' },
              ...result.users.map((user: any) => ({
                type: 'users',
                id: user.id,
              })),
            ]
          : [{ type: 'users', id: 'LIST' }],
    }),
    registerUser: builder.mutation({
      query: (body) => ({
        url: `/auth/register`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'users', id: 'LIST' }, // refetch list
      ],
    }),
  }),
});

export const { useGetAllUsersQuery, useRegisterUserMutation } = users_api;
