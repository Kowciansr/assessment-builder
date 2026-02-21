import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.response.use(
  (res) => res.data,
  (err) => Promise.reject(err.response?.data?.error || err.message || 'Request failed')
);

export const uploadFile = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
};

export const generateQuestions = (data) => api.post('/questions/generate', data);
export const getSessionQuestions = (sessionId) => api.get(`/sessions/${sessionId}/questions`);
export const updateQuestion = (id, data) => api.put(`/questions/${id}`, data);
export const deleteQuestion = (id) => api.delete(`/questions/${id}`);
export const regenerateQuestion = (id, data) => api.post(`/questions/${id}/regenerate`, data);
export const validateQuestion = (id, data) => api.post(`/questions/${id}/validate`, data);
export const improveDistractors = (id, data) => api.post(`/questions/${id}/improve-distractors`, data);
export const increaseCognitiveLevel = (id) => api.post(`/questions/${id}/increase-level`);
export const saveToBank = (id, data) => api.post(`/questions/${id}/save`, data);
export const getQuestionBank = (params) => api.get('/bank', { params });

export const exportQuestions = async (payload) => {
  const response = await axios.post('/api/export', payload, { responseType: 'blob' });
  const ext = payload.format;
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  const cd = response.headers['content-disposition'] || '';
  const filename = cd.match(/filename="(.+)"/)?.[1] || `questions.${ext}`;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
