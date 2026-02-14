import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from '../../redux/baseQuery.ts';

export const orders_api = createApi({
  reducerPath: 'orders',
  tagTypes: ['orders'],
  baseQuery: baseQueryWithReauth,
  endpoints: (builder) => ({
    getAllOrders: builder.query({
      query: ({ offset, limit }) =>
        `/orders/orders?offset=${offset ?? 0}&limit=${limit ?? 100}`,
      transformResponse: (response) => response,
      providesTags: (result) =>
        result?.orders
          ? [
              { type: 'orders', id: 'LIST' },
              ...result.orders.map((order) => ({
                type: 'orders',
                id: order.id,
              })),
            ]
          : [{ type: 'orders', id: 'LIST' }],
    }),
    getOrder: builder.query({
      query: ({ id }) => `/orders/${id}`,
      transformResponse: (response) => response,
      providesTags: (result, error, arg) => [{ type: 'orders', id: arg.id }],
    }),
    updateOrder: builder.mutation({
      query: ({ id, body }) => ({
        url: `/orders/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'orders', id: arg.id }, // refetch this order
        { type: 'orders', id: 'LIST' }, // refetch list
      ],
      //optimistic update
      async onQueryStarted({ id, body }, { dispatch, queryFulfilled }) {
        // 1️⃣ Immediately update the cache for the single bill
        const patchResult = dispatch(
          orders_api.util.updateQueryData('getOrder', { id }, (draft) => {
            Object.assign(draft, body); // merge changes
          }),
        );

        // 2️⃣ Optionally update the list cache too
        const patchListResult = dispatch(
          orders_api.util.updateQueryData(
            'getAllOrders',
            { patient_query: '', offset: 0 },
            (draft) => {
              const order = draft.orders.find((b) => b.id === id);
              if (order) Object.assign(order, body);
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
    getPayerTypes: builder.query({
      query: (args) => {
        const params: Record<int, any> = {};
        if (args.payer_id) params['payer_id'] = args.payer_id;
        return {
          url: '/orders/payers',
          params,
        };
      },
      transformResponse: (response) => response,
    }),
  }),
});

export const {
  useGetAllOrdersQuery,
  useGetOrderQuery,
  useUpdateOrderMutation,
  useGetPayerTypesQuery,
} = orders_api;
