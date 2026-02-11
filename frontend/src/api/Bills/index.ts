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
      providesTags: (result) =>
        result?.bills
          ? [
              { type: 'bills', id: 'LIST' },
              ...result.bills.map((bill: any) => ({
                type: 'bills',
                id: bill.id,
              })),
            ]
          : [{ type: 'bills', id: 'LIST' }],
    }),
    getBill: builder.query({
      query: ({ id }) => `/bills/${id}`,
      transformResponse: (response: any) => response,
      providesTags: (result, error, arg) => [{ type: 'bills', id: arg.id }],
    }),
    updateBill: builder.mutation({
      query: ({ id, body }) => ({
        url: `/bills/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'bills', id: arg.id }, // refetch this bill
        { type: 'bills', id: 'LIST' }, // refetch list
      ],
      //optimistic update
      async onQueryStarted({ id, body }, { dispatch, queryFulfilled }) {
        // 1️⃣ Immediately update the cache for the single bill
        const patchResult = dispatch(
          bills_api.util.updateQueryData('getBill', { id }, (draft) => {
            Object.assign(draft, body); // merge changes
          }),
        );

        // 2️⃣ Optionally update the list cache too
        const patchListResult = dispatch(
          bills_api.util.updateQueryData(
            'getAllBills',
            { patient_query: '', offset: 0 },
            (draft) => {
              const bill = draft.bills.find((b: any) => b.id === id);
              if (bill) Object.assign(bill, body);
            },
          ),
        );
        try {
          // wait for the server to respond
          await queryFulfilled;
        } catch {
          // rollback if server failed
          patchResult.undo();
          patchListResult.undo();
        }
      },
    }),
  }),
});

export const { useGetAllBillsQuery, useGetBillQuery, useUpdateBillMutation } =
  bills_api;
