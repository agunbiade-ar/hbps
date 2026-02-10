import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from '../../redux/baseQuery.ts';

export const bills_api = createApi({
  reducerPath: 'bills',
  tagTypes: ['bills'],
  baseQuery: baseQueryWithReauth,
  endpoints: (builder) => ({
    getAllBills: builder.query({
      query: ({ patient_query, offset }) =>
        `/bills/bills?offset=${offset ?? 0}&patient_query=${patient_query ?? ''}`,
      transformResponse: (response) => response,
    }),
    getBill: builder.query({
      query: ({ id }) => `/bills/${id}`,
      transformResponse: (response: any) => response,
      providesTags: ['bills'],
    }),
    updateBill: builder.mutation({
      query: ({id, body}) => ({
        url: `/bills/${id}`,
        method: 'PATCH',
        body,
      }),
    })
  }),
});

export const { useGetAllBillsQuery, useGetBillQuery, useUpdateBillMutation } = bills_api;
