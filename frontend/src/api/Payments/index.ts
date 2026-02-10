import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from '../../redux/baseQuery.ts';

export const payments_api = createApi({
  reducerPath: 'payments',
  tagTypes: ['payments'],
  baseQuery: baseQueryWithReauth,
  endpoints: (builder) => ({
    getAllPayments: builder.query({
      query: ({ receipt_number, offset, limit }) =>
        `/payments/payments?offset=${offset ?? 0}&receipt_number=${receipt_number ?? ''}&limit=${limit ?? 100}`,
      transformResponse: (response) => response,
    }),
    getPayment: builder.query({
      query: ({ id }) => `/payments/${id}`,
      transformResponse: (response: any) => response,
      providesTags: ['payments'],
    }),
  }),
});

export const { useGetAllPaymentsQuery, useGetPaymentQuery } = payments_api;
