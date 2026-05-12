import { useEffect, useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import toast from 'react-hot-toast';
import { createAppointment, getAvailableSlots, getClients, deleteClient, type ClientSummary } from '../api';

const appointmentSchema = Yup.object({
  client_id: Yup.number().positive('Please select a client').required('Client is required'),
  service_type: Yup.string().required('Service type is required'),
  interview_time: Yup.string().required('Interview date/time is required'),
  schedule_time: Yup.string(),
});

const ClientScheduler = () => {
  const [slots, setSlots] = useState<Array<{ schedule_time: string }>>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [clientSearch, setClientSearch] = useState('');

  const normalizeText = (value: unknown) => String(value ?? '').toLowerCase();

  const loadClients = async () => {
    try {
      const res = await getClients();
      setClients(res.data);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load clients.');
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const filteredClients = clients.filter((client) => {
    const keyword = normalizeText(clientSearch.trim());
    if (!keyword) return true;
    const fullName = normalizeText(`${client.first_name} ${client.last_name}`);
    return (
      fullName.includes(keyword)
      || normalizeText(client.phone_number).includes(keyword)
      || normalizeText(client.email).includes(keyword)
      || normalizeText(client.agency_name).includes(keyword)
      || normalizeText(client.client_id).includes(keyword)
    );
  });

  const handleFetchSlots = async (values: { service_type: string; interview_time: string }) => {
    if (!values.service_type || !values.interview_time) {
      toast.error('Please select service and interview time first');
      return;
    }
    try {
      const res = await getAvailableSlots(values.service_type, values.interview_time);
      setSlots(res.data);
      toast.success(`${res.data.length} available slot(s) loaded`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load available slots');
    }
  };

  const handleDeleteClient = async (clientId: number, clientName: string) => {
    if (!window.confirm(`Are you sure you want to delete client "${clientName}"? All related appointments will be deleted.`)) {
      return;
    }
    try {
      await deleteClient(clientId);
      toast.success('Client deleted successfully');
      loadClients();
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete client');
    }
  };

  return (
    <div className="panel">
      <h1>Client Scheduler</h1>
      <p>Select a service and interview date, then choose a recommended slot.</p>

      <section className="card">
        <Formik
          initialValues={{ client_id: 0, service_type: 'career_training', interview_time: '', schedule_time: '' }}
          validationSchema={appointmentSchema}
          onSubmit={async (values, { resetForm }) => {
            try {
              const payload = {
                client_id: values.client_id,
                service_type: values.service_type,
                interview_time: values.interview_time,
                schedule_time: values.schedule_time || undefined,
              };
              const res = await createAppointment(payload);
              toast.success(res.data.message || 'Appointment created successfully!');
              resetForm();
              setClientSearch('');
              setSlots([]);
            } catch (error) {
              console.error(error);
              toast.error('Failed to create appointment. Please try again.');
            }
          }}
        >
          {({ values, setFieldValue }) => (
            <>
              <Form className="form-grid">
                <label>
                  Search client (name / phone / email)
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                      }
                    }}
                    placeholder="Type and click a client below"
                  />
                </label>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ marginBottom: '8px' }}>
                    Client results
                  </label>
                  <Field type="hidden" name="client_id" />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {filteredClients.slice(0, 10).map((client) => {
                      const isSelected = values.client_id === client.client_id;
                      return (
                        <button
                          key={client.client_id}
                          type="button"
                          onClick={() => {
                            setFieldValue('client_id', client.client_id);
                            setClientSearch(`${client.first_name} ${client.last_name}`);
                          }}
                          style={{
                            background: isSelected ? '#aa2222' : '#ffffff',
                            color: isSelected ? '#ffffff' : '#aa2222',
                            border: '1px solid #aa2222',
                            borderRadius: '999px',
                            padding: '8px 12px',
                            boxShadow: 'none',
                          }}
                        >
                          {client.first_name} {client.last_name}
                          {client.agency_name ? ` - ${client.agency_name}` : ''}
                        </button>
                      );
                    })}
                  </div>
                  {clientSearch && filteredClients.length === 0 && (
                    <div className="field-error">No clients matched your search.</div>
                  )}
                  {!clientSearch && filteredClients.length > 10 && (
                    <div style={{ marginTop: '6px', fontSize: '0.9rem', color: '#6b2a2a' }}>
                      Showing first 10 clients. Type to narrow results.
                    </div>
                  )}
                  <ErrorMessage name="client_id" component="div" className="field-error" />
                </div>
                <label>
                  Service type
                  <Field as="select" name="service_type">
                    <option value="career_training">Career Training</option>
                    <option value="styling">Styling</option>
                    <option value="mock_interview">Mock Interview</option>
                  </Field>
                  <ErrorMessage name="service_type" component="div" className="field-error" />
                </label>
                <label>
                  Interview date/time
                  <Field type="datetime-local" name="interview_time" />
                  <ErrorMessage name="interview_time" component="div" className="field-error" />
                </label>
                <label>
                  Chosen slot
                  <Field type="datetime-local" name="schedule_time" />
                </label>
                <button type="button" onClick={() => handleFetchSlots(values)}>Load available slots</button>
                <button type="submit">Create appointment</button>
              </Form>

              {slots.length > 0 && (
                <section className="card">
                  <h2>Available slots</h2>
                  <ul className="list">
                    {slots.map((slot) => (
                      <li key={slot.schedule_time}>
                        <span>{slot.schedule_time.replace('T', ' ')}</span>
                        <button type="button" onClick={() => setFieldValue('schedule_time', slot.schedule_time)}>
                          Select
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </Formik>
      </section>

      <section className="card">
        <h2>Manage clients</h2>
        {clients.length === 0 ? (
          <p>No clients available.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {clients.map((client) => (
              <div key={client.client_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#fafafa' }}>
                <div>
                  <strong>{client.first_name} {client.last_name}</strong>
                  {client.agency_name && <div style={{ fontSize: '0.9rem', color: '#666' }}>({client.agency_name})</div>}
                </div>
                <button type="button" onClick={() => handleDeleteClient(client.client_id, `${client.first_name} ${client.last_name}`)} style={{ backgroundColor: '#ee1000', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 12px', cursor: 'pointer' }}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default ClientScheduler;
