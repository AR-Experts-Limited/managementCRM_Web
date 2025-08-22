import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL;

// Async Thunks
export const fetchPersonnels = createAsyncThunk('personnels/fetchPersonnels', async () => {
  const response = await axios.get(`${API_BASE_URL}/api/personnels`);
  return response.data;
});

export const addPersonnel = createAsyncThunk('personnels/addPersonnel', async (personnel) => {
  const response = await axios.post(`${API_BASE_URL}/api/personnels`, personnel, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
});

export const updatePersonnel = createAsyncThunk(
  'personnels/updatePersonnel',
  async (personnel, { getState, rejectWithValue }) => {
    const id = personnel.get('_id'); // personnel is FormData here
    const state = getState();

    // Flatten all personnels from all roles to find the prior role
    const allPersonnels = Object.values(state.personnels.byRole).flat();
    const existingPersonnel = allPersonnels.find((d) => d._id === id);
    const previousRole = existingPersonnel?.role;

    try {
      const response = await axios.put(
        `${API_BASE_URL}/api/personnels/newupdate/${id}`,
        personnel,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return { updatedPersonnel: response.data, previousRole };
    } catch (err) {
      return rejectWithValue(err || { message: 'An unexpected error occurred' });
    }
  }
);

export const updatePersonnelDoc = createAsyncThunk(
  'personnels/updatePersonnelDoc',
  async ({ personnel, updates }) => {
    const id = personnel._id;
    const response = await axios.put(`${API_BASE_URL}/api/personnels/docUpdate/${id}`, updates);
    return { updatedPersonnel: response.data };
  }
);

export const disablePersonnel = createAsyncThunk(
  'personnels/disablePersonnel',
  async ({ personnel, email, disabled }) => {
    const id = personnel._id;
    const role = personnel.role; // single role string
    const response = await axios.post(
      `${API_BASE_URL}/api/personnels/togglePersonnel/${id}`,
      { email, disabled }
    );
    return { disabledPersonnel: response.data.disabledPersonnel, role };
  }
);

// You may pass role for efficiency; if not passed, reducer will remove across all roles.
export const deletePersonnel = createAsyncThunk(
  'personnels/deletePersonnel',
  async ({ id, role }) => {
    await axios.delete(`${API_BASE_URL}/api/personnels/${id}`);
    return { personnelId: id, role };
  }
);

// Group personnels by single role
const groupByRole = (personnels) =>
  personnels.reduce((acc, personnel) => {
    const role = personnel.role;
    if (!role) return acc;
    if (!acc[role]) acc[role] = [];
    acc[role].push(personnel);
    return acc;
  }, {});

const personnelSlice = createSlice({
  name: 'personnels',
  initialState: {
    byRole: {},              // Group by single role string
    personnelStatus: 'idle',
    error: null,
    addStatus: 'idle',
    updateStatus: 'idle',
    disableStatus: 'idle',
    deleteStatus: 'idle',
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Fetch Personnels
      .addCase(fetchPersonnels.pending, (state) => {
        state.personnelStatus = 'loading';
      })
      .addCase(fetchPersonnels.fulfilled, (state, action) => {
        state.personnelStatus = 'succeeded';
        state.byRole = groupByRole(action.payload);
      })
      .addCase(fetchPersonnels.rejected, (state, action) => {
        state.personnelStatus = 'failed';
        state.error = action.error.message;
      })

      // Add Personnel
      .addCase(addPersonnel.pending, (state) => {
        state.addStatus = 'loading';
      })
      .addCase(addPersonnel.fulfilled, (state, action) => {
        state.addStatus = 'succeeded';
        const personnel = action.payload;
        const role = personnel.role;
        if (!role) return;
        if (!state.byRole[role]) state.byRole[role] = [];
        state.byRole[role].push(personnel);
      })
      .addCase(addPersonnel.rejected, (state, action) => {
        state.addStatus = 'failed';
        state.error = action.error.message;
      })

      // Update Personnel
      .addCase(updatePersonnel.pending, (state) => {
        state.updateStatus = 'loading';
      })
      .addCase(updatePersonnel.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded';
        const { updatedPersonnel, previousRole } = action.payload;
        const newRole = updatedPersonnel.role;

        // Same role: update in place
        if (previousRole === newRole) {
          const bucket = state.byRole[newRole] || [];
          const index = bucket.findIndex((d) => d._id === updatedPersonnel._id);
          if (index !== -1) bucket[index] = updatedPersonnel;
          state.byRole[newRole] = bucket;
        } else {
          // Role changed: remove from old, add to new
          if (previousRole && state.byRole[previousRole]) {
            state.byRole[previousRole] = state.byRole[previousRole].filter(
              (d) => d._id !== updatedPersonnel._id
            );
          }
          if (!state.byRole[newRole]) state.byRole[newRole] = [];
          state.byRole[newRole].push(updatedPersonnel);
        }
      })
      .addCase(updatePersonnel.rejected, (state, action) => {
        state.updateStatus = 'failed';
        state.error = action.error.message;
      })

      // Update Personnel Doc (role is not expected to change here)
      .addCase(updatePersonnelDoc.pending, (state) => {
        state.updateStatus = 'loading';
      })
      .addCase(updatePersonnelDoc.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded';
        const { updatedPersonnel } = action.payload;
        const role = updatedPersonnel.role;
        if (!role || !state.byRole[role]) return;
        const index = state.byRole[role].findIndex((d) => d._id === updatedPersonnel._id);
        if (index !== -1) state.byRole[role][index] = updatedPersonnel;
      })
      .addCase(updatePersonnelDoc.rejected, (state, action) => {
        state.updateStatus = 'failed';
        state.error = action.error.message;
      })

      // Disable Personnel
      .addCase(disablePersonnel.pending, (state) => {
        state.disableStatus = 'loading';
      })
      .addCase(disablePersonnel.fulfilled, (state, action) => {
        state.disableStatus = 'succeeded';
        const { disabledPersonnel, role } = action.payload;
        if (!role || !state.byRole[role]) return;
        const index = state.byRole[role].findIndex((d) => d._id === disabledPersonnel?._id);
        if (index !== -1) state.byRole[role][index] = disabledPersonnel;
      })
      .addCase(disablePersonnel.rejected, (state, action) => {
        state.disableStatus = 'failed';
        state.error = action.error.message;
      })

      // Delete Personnel
      .addCase(deletePersonnel.pending, (state) => {
        state.deleteStatus = 'loading';
      })
      .addCase(deletePersonnel.fulfilled, (state, action) => {
        state.deleteStatus = 'succeeded';
        const { personnelId, role } = action.payload;

        if (role && state.byRole[role]) {
          // Remove from the specified role bucket
          state.byRole[role] = state.byRole[role].filter((d) => d._id !== personnelId);
        } else {
          // Fallback: remove from all role buckets (handles unknown role at call site)
          for (const r of Object.keys(state.byRole)) {
            state.byRole[r] = state.byRole[r].filter((d) => d._id !== personnelId);
          }
        }
      })
      .addCase(deletePersonnel.rejected, (state, action) => {
        state.deleteStatus = 'failed';
        state.error = action.error.message;
      });
  },
});

export default personnelSlice.reducer;