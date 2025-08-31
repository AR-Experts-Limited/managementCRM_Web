// axios-interceptor.js
import axios from 'axios';
import { FRONTEND_VERSION } from '../version'; // from shared version.json

axios.interceptors.request.use(
    config => {
        config.headers['X-Frontend-Version'] = FRONTEND_VERSION;
        return config;
    },
    error => Promise.reject(error)
);

axios.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 426) {
            console.warn('Frontend outdated — refreshing...');
            window.location.reload(true);
        }
        return Promise.reject(error);
    }
);

export default axios;
