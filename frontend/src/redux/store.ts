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

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['auth'],
};

const rootReducer = combineReducers({
  auth: authReducer,
  [bills_api.reducerPath]: bills_api.reducer,
  [payments_api.reducerPath]: payments_api.reducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
      immutableCheck: false,
    }).concat([bills_api.middleware, payments_api.middleware]),
});

export const persistor = persistStore(store);
export type RootState = ReturnType<typeof store.getState>;
export const useAppDispatch: () => typeof store.dispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
