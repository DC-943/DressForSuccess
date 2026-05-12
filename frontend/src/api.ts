import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
});

export type AgencyPayload = {
  agency_name: string;
  category: string;
  main_contact_name: string;
  contact_email: string;
};

export type ClientPayload = {
  referral_agency_id: number;
  first_name: string;
  last_name: string;
  phone_number?: string;
  email?: string;
  job_status?: string;
};

export type ClientSummary = {
  client_id: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone_number?: string;
  agency_name?: string;
};

export type AppointmentPayload = {
  client_id: number;
  service_type: string;
  interview_time: string;
  schedule_time?: string;
};

export type VolunteerPayload = {
  full_name: string;
  specialty: string;
  availability_pattern: Array<{ date: string; start: string; end: string }>;
  training_completed?: boolean;
};

export const createAgency = (payload: AgencyPayload) => client.post('/agencies', payload);
export const getAgencies = () => client.get('/agencies');
export const deleteAgency = (agencyId: number) => client.delete(`/agencies/${agencyId}`);
export const createClient = (payload: ClientPayload) => client.post('/clients', payload);
export const deleteClient = (clientId: number) => client.delete(`/clients/${clientId}`);
export const getClients = () => client.get<ClientSummary[]>('/clients');
export const createAppointment = (payload: AppointmentPayload) => client.post('/appointments', payload);
export const getAvailableSlots = (serviceType: string, interviewTime: string) => client.get('/appointments/slots', { params: { service_type: serviceType, interview_time: interviewTime } });
export const getAgencyProgress = (agencyId: number) => client.get(`/agencies/${agencyId}/progress`);
export const getDashboardStats = () => client.get('/dashboard/stats');
export const getAgencyStats = () => client.get('/dashboard/agency-stats');
export const getClientProgress = () => client.get('/dashboard/client-progress');
export const getVolunteers = () => client.get('/volunteers');
export const createVolunteer = (payload: VolunteerPayload) => client.post('/volunteers', payload);
export const deleteVolunteer = (volunteerId: number) => client.delete(`/volunteers/${volunteerId}`);
export const getPendingAppointments = () => client.get('/appointments/status/pending_assignment');
export const getVolunteerTasks = (volunteerId: number) => client.get(`/appointments/volunteer/${volunteerId}`);
export const assignAppointment = (apptId: number, volunteerId: number) => client.put(`/appointments/${apptId}/assign/${volunteerId}`);
export const completeAppointment = (apptId: number, data: { confidence_score_pre: number; confidence_score_post: number; outcome_notes: string }) => client.put(`/appointments/${apptId}/complete`, data);
export const rescheduleAppointment = (apptId: number, scheduleTime: string) => client.put(`/appointments/${apptId}/schedule`, { schedule_time: scheduleTime });
