import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cmrs_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('cmrs_refresh_token');
      if (refreshToken) {
        try {
          const res = await axios.post('/api/auth/refresh/', { refresh: refreshToken });
          localStorage.setItem('cmrs_access_token', res.data.access);
          originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
          return api(originalRequest);
        } catch (refreshErr) {
          localStorage.removeItem('cmrs_access_token');
          localStorage.removeItem('cmrs_refresh_token');
          localStorage.removeItem('cmrs_user');
          window.location.reload();
        }
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (username, password) => api.post('/auth/login/', { username, password }),
  getMe: () => api.get('/auth/me/'),
  getDemoUsers: () => api.get('/auth/demo-users/'),
};

export const dashboardApi = {
  getAnalytics: (params) => api.get('/dashboard/analytics/', { params }),
};

export const loansApi = {
  getCustomers: (params) => api.get('/customers/', { params }),
  getLoans: (params) => api.get('/loans/', { params }),
  getLoan: (id) => api.get(`/loans/${id}/`),
  getLoanSchedules: (id) => api.get(`/loans/${id}/schedules/`),
  getLoanHistory: (id) => api.get(`/loans/${id}/history/`),
};

export const collectionsApi = {
  getCollections: (params) => api.get('/collections/', { params }),
  recordCollection: (data) => api.post('/collections/', data),
  getDailySummary: () => api.get('/collections/daily_summary/'),
  submitBatch: (data) => api.post('/collections/submit_batch/', data),
};

export const submissionsApi = {
  getSubmissions: (params) => api.get('/submissions/', { params }),
  getSubmission: (id) => api.get(`/submissions/${id}/`),
  reconcile: (id, data) => api.post(`/submissions/${id}/reconcile/`, data),
  reject: (id, data) => api.post(`/submissions/${id}/reject/`, data),
};

export const bankingApi = {
  getDeposits: (params) => api.get('/bank-deposits/', { params }),
  createDeposit: (data) => api.post('/bank-deposits/', data),
  settleDeposit: (id, data) => api.post(`/bank-deposits/${id}/settle/`, data),
  markFailed: (id, data) => api.post(`/bank-deposits/${id}/mark-failed/`, data),
};

export const discrepanciesApi = {
  getDiscrepancies: (params) => api.get('/discrepancies/', { params }),
  resolve: (id, data) => api.post(`/discrepancies/${id}/resolve/`, data),
};

export const auditApi = {
  getLogs: (params) => api.get('/audit-logs/', { params }),
};

export const branchesApi = {
  getBranches: () => api.get('/branches/'),
};

export default api;
