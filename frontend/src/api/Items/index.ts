import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from '../../redux/baseQuery.ts';

export const items_api = createApi({
  reducerPath: 'items',
  tagTypes: ['items'],
  baseQuery: baseQueryWithReauth,
  endpoints: (builder) => ({
    getAllItems: builder.query({
      query: ({ search, offset }) =>
        `/items/items?offset=${offset ?? 0}&search=${search ?? ''}`,
      transformResponse: (response) => response,
      providesTags: (result) =>
        result?.items
          ? [
              { type: 'items', id: 'LIST' },
              ...result.items.map((item: any) => ({
                type: 'items',
                id: item.id,
              })),
            ]
          : [{ type: 'items', id: 'LIST' }],
    }),
    getItem: builder.query({
      query: ({ id }) => `/items/${id}`,
      transformResponse: (response: any) => response,
      providesTags: (_result, _error, arg) => [{ type: 'items', id: arg.id }],
    }),
    updateItem: builder.mutation({
      query: ({ id, body }) => ({
        url: `/items/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'items', id: arg.id }, // refetch this item
        { type: 'items', id: 'LIST' }, // refetch list
      ],
      //optimistic update
      async onQueryStarted({ id, body }, { dispatch, queryFulfilled }) {
        // 1️⃣ Immediately update the cache for the single item
        const patchResult = dispatch(
          items_api.util.updateQueryData('getItem', { id }, (draft) => {
            Object.assign(draft, body); // merge changes
          }),
        );

        // 2️⃣ Optionally update the list cache too
        const patchListResult = dispatch(
          items_api.util.updateQueryData(
            'getAllItems',
            { patient_query: '', offset: 0 },
            (draft) => {
              const item = draft.items.find((i: any) => i.id === id);
              if (item) Object.assign(item, body);
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
    updateItemPrices: builder.mutation({
      query: ({ body }) => ({
        url: `/items/items-price`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'items', id: arg.id }, // refetch this item
        { type: 'items', id: 'LIST' }, // refetch list
      ],
      //optimistic update
      async onQueryStarted({ id, body }, { dispatch, queryFulfilled }) {
        // 1️⃣ Immediately update the cache for the single item
        const patchResult = dispatch(
          items_api.util.updateQueryData('getItem', { id }, (draft) => {
            Object.assign(draft, body); // merge changes
          }),
        );

        // 2️⃣ Optionally update the list cache too
        const patchListResult = dispatch(
          items_api.util.updateQueryData(
            'getAllItems',
            { patient_query: '', offset: 0 },
            (draft) => {
              const item = draft.items.find((i: any) => i.id === id);
              if (item) Object.assign(item, body);
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

export const {
  useGetAllItemsQuery,
  useGetItemQuery,
  useUpdateItemPricesMutation,
} = items_api;
