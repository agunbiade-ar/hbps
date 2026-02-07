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
    }),
  }),
});

export const { useGetAllBillsQuery, useGetBillQuery } = bills_api;
