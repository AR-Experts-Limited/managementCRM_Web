import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL;

// Async Thunks
export const fetchRoles = createAsyncThunk('roles/fetchRoles', async () => {
  const response = await axios.get(`${API_BASE_URL}/api/roles`);
  return response.data; // expecting string[]
});

const roleSlice = createSlice({
  name: 'roles',
  initialState: {
    list: [],          // e.g., ["Driver", "Loader", "Supervisor"]
    roleStatus: 'idle',
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Fetch Roles
      .addCase(fetchRoles.pending, (state) => {
        state.roleStatus = 'loading';
      })
      .addCase(fetchRoles.fulfilled, (state, action) => {
        state.roleStatus = 'succeeded';
        state.list = action.payload;
      })
      .addCase(fetchRoles.rejected, (state, action) => {
        state.roleStatus = 'failed';
        state.error = action.error.message;
      });
  },
});

export default roleSlice.reducer;