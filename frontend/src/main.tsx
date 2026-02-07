import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {BrowserRouter} from "react-router-dom";
import {Provider} from 'react-redux'
import {PersistGate} from "redux-persist/integration/react";
import {store, persistor} from './redux/store.ts'

import './index.scss'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
            <Provider store={store}>
                    <PersistGate loading={null} persistor={persistor}>
                            <BrowserRouter>
                                    <App />
                            </BrowserRouter>
                    </PersistGate>
            </Provider>
    </StrictMode>
        )
