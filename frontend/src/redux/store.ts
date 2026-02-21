import { combineReducers, configureStore } from '@reduxjs/toolkit';
import {
  type TypedUseSelectorHook,
  useDispatch,
  useSelector,
} from 'react-redux';
import { persistReducer, persistStore } from 'redux-persist';
import storage from 'redux-persist/es/storage';
import authReducer from './features/slices/authSlice';
import { bills_api } from '../api/Bills';
import { payments_api } from '../api/Payments';
import { orders_api } from '../api/Orders';
import { facility_api } from '../api/Facility';
import { users_api } from '../api/Users';
import { items_api } from '../api/Items';
import { payers_api } from '../api/Payers';

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['auth'],
};

const rootReducer = combineReducers({
  auth: authReducer,
  [bills_api.reducerPath]: bills_api.reducer,
  [payments_api.reducerPath]: payments_api.reducer,
  [orders_api.reducerPath]: orders_api.reducer,
  [facility_api.reducerPath]: facility_api.reducer,
  [users_api.reducerPath]: users_api.reducer,
  [items_api.reducerPath]: items_api.reducer,
  [payers_api.reducerPath]: payers_api.reducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
      immutableCheck: false,
    }).concat([
      bills_api.middleware,
      payments_api.middleware,
      orders_api.middleware,
      facility_api.middleware,
      users_api.middleware,
      items_api.middleware,
      payers_api.middleware,
    ]),
});

export const persistor = persistStore(store);
export type RootState = ReturnType<typeof store.getState>;
export const useAppDispatch: () => typeof store.dispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
