import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from '../../redux/baseQuery.ts';

export const payments_api = createApi({
  reducerPath: 'payments',
  tagTypes: ['payments'],
  baseQuery: baseQueryWithReauth,
  endpoints: (builder) => ({
    getAllPayments: builder.query({
      query: (args) => {
        const params: Record<string, any> = {};
        if (args.receipt_number) params['receipt_number'] = args.receipt_number;
        if (args.start_date) params.start_date = args.start_date;
        if (args.end_date) params.end_date = args.end_date;

        params.today = args.today;
        params.limit = args.limit;
        params.offset = args.offset;
        return {
          url: '/payments/payments',
          params,
        };
      },
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
