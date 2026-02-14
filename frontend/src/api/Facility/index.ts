import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from '../../redux/baseQuery.ts';

export const facility_api = createApi({
  reducerPath: 'facility',
  tagTypes: ['facility'],
  baseQuery: baseQueryWithReauth,
  endpoints: (builder) => ({
    getFacility: builder.query({
      query: ({ id }) => `/facilities/${id}`,
      transformResponse: (response) => response,
      providesTags: (result, error, arg) => [{ type: 'facility', id: arg.id }],
    }),
  }),
});

export const { useGetFacilityQuery } = facility_api;
