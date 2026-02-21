import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from '../../redux/baseQuery.ts';

export const payers_api = createApi({
  reducerPath: 'payers',
  tagTypes: ['payers'],
  baseQuery: baseQueryWithReauth,
  endpoints: (builder) => ({
    getPayerTypes: builder.query({
      query: (args?: { payer_id?: number }) => {
        const params: Record<string, any> = {};
        if (args?.payer_id) params['payer_id'] = args.payer_id;

        return {
          url: '/payers/payers',
          params,
        };
      },
      transformResponse: (response: any) => response,
      providesTags: (result) =>
        result?.payers
          ? [
              { type: 'payers', id: 'LIST' },
              ...result.payers.map((payer: any) => ({
                type: 'payers',
                id: payer.id,
              })),
            ]
          : [{ type: 'payers', id: 'LIST' }],
    }),

    createPayer: builder.mutation({
      query: ({ body }) => ({
        url: `/payers/payers`,
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'payers', id: 'LIST' }],
    }),
    updatePayer: builder.mutation({
      query: ({ id, body }) => ({
        url: `/payers/${id}`,
        method: 'PUT',
        body,
      }),

      invalidatesTags: (_result, _error, arg) => [
        { type: 'payers', id: arg.id },
        { type: 'payers', id: 'LIST' },
      ],

      async onQueryStarted({ id, body }, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          payers_api.util.updateQueryData(
            'getPayerTypes',
            undefined,
            (draft) => {
              const payer = draft?.payers?.find((i: any) => i.id === id);
              if (payer) {
                Object.assign(payer, body);
              }
            },
          ),
        );

        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
    }),
    deletePayer: builder.mutation({
      query: (id) => ({
        url: `/payers/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'payers', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetPayerTypesQuery,
  useCreatePayerMutation,
  useUpdatePayerMutation,
  useDeletePayerMutation,
} = payers_api;
