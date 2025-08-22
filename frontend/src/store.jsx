import { configureStore, combineReducers } from '@reduxjs/toolkit';
import storage from 'redux-persist/lib/storage';
import { persistReducer, persistStore } from 'redux-persist';

import autoLogoutMiddleware from './features/auth/autoLogout';
import authReducer from './features/auth/authSlice';
import sseReducer from './features/sse/sseSlice';
import siteReducer from './features/sites/siteSlice';
import roleReducer from './features/roles/roleSlice';
import personnelReducer from './features/personnels/personnelSlice';

const rootReducer = combineReducers({
    auth: authReducer,
    sse: sseReducer,
    sites: siteReducer,
    roles: roleReducer,
    personnels: personnelReducer
});

const persistConfig = {
    key: 'root',
    storage,
    whitelist: ['auth'],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false,
        }).concat(autoLogoutMiddleware), // Add autoLogoutMiddleware
});

export const persistor = persistStore(store);
