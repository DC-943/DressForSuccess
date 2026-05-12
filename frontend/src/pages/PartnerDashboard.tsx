import { useEffect, useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import toast from 'react-hot-toast';
import { createAgency, createClient, getAgencyProgress, getAgencies, deleteAgency } from '../api';

const agencySchema = Yup.object({
  agency_name: Yup.string().required('Agency name is required'),
  category: Yup.string().required('Category is required'),
  main_contact_name: Yup.string().required('Contact person is required'),
  contact_email: Yup.string().email('Enter a valid email').required('Contact email is required'),
});

const clientSchema = Yup.object({
  referral_agency_id: Yup.number().moreThan(0, 'Select an agency').required('Agency is required'),
  first_name: Yup.string().required('First name is required'),
  last_name: Yup.string().required('Last name is required'),
  phone_number: Yup.string(),
  email: Yup.string().email('Enter a valid email'),
  job_status: Yup.string().required('Job status is required'),
});

const PartnerDashboard = () => {
  const [agencies, setAgencies] = useState<any[]>([]);
  const [agencyProgress, setAgencyProgress] = useState<any[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<number>(0);

  useEffect(() => {
    loadAgencies();
  }, []);

  const loadAgencies = async () => {
    try {
      const res = await getAgencies();
      setAgencies(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadAgencyProgress = async (agencyId: number) => {
    if (!agencyId) {
      setAgencyProgress([]);
      return;
    }
    try {
      const res = await getAgencyProgress(agencyId);
      setAgencyProgress(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteAgency = async (agencyId: number, agencyName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${agencyName}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteAgency(agencyId);
      toast.success('Agency deleted successfully');
      loadAgencies();
      setSelectedAgencyId(0);
      setAgencyProgress([]);
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete agency');
    }
  };

  return (
    <div className="panel">
      <h1>Partner Portal</h1>
      <p>Register a partner agency and refer a client.</p>

      <section className="card">
        <h2>Agency registration</h2>
        <Formik
          initialValues={{ agency_name: '', category: 'employment_center', main_contact_name: '', contact_email: '' }}
          validationSchema={agencySchema}
          onSubmit={async (values, { resetForm }) => {
            try {
              const res = await createAgency(values);
              toast.success(res.data.message || 'Agency registered successfully!');
              resetForm();
              loadAgencies();
            } catch (error) {
              toast.error('Failed to register agency. Please try again.');
            }
          }}
        >
          <Form className="form-grid">
            <label>
              Agency name
              <Field name="agency_name" />
              <ErrorMessage name="agency_name" component="div" className="field-error" />
            </label>
            <label>
              Category
              <Field as="select" name="category">
                <option value="employment_center">Employment Center</option>
                <option value="refugee_support">Refugee Support</option>
                <option value="domestic_violence">Domestic Violence</option>
                <option value="university">University</option>
              </Field>
              <ErrorMessage name="category" component="div" className="field-error" />
            </label>
            <label>
              Contact person
              <Field name="main_contact_name" />
              <ErrorMessage name="main_contact_name" component="div" className="field-error" />
            </label>
            <label>
              Contact email
              <Field type="email" name="contact_email" />
              <ErrorMessage name="contact_email" component="div" className="field-error" />
            </label>
            <button type="submit">Register agency</button>
          </Form>
        </Formik>
      </section>

      <section className="card">
        <h2>Refer a client</h2>
        <Formik
          initialValues={{ referral_agency_id: 0, first_name: '', last_name: '', phone_number: '', email: '', job_status: 'unemployed' }}
          validationSchema={clientSchema}
          onSubmit={async (values, { resetForm }) => {
            try {
              const res = await createClient(values);
              toast.success(res.data.message || 'Client referred successfully!');
              resetForm();
            } catch (error) {
              toast.error('Failed to refer client. Please try again.');
            }
          }}
        >
          <Form className="form-grid">
            <label>
              Agency
              <Field as="select" name="referral_agency_id">
                <option value={0}>Select agency</option>
                {agencies.map((agency) => (
                  <option key={agency.agency_id} value={agency.agency_id}>{agency.agency_name}</option>
                ))}
              </Field>
              <ErrorMessage name="referral_agency_id" component="div" className="field-error" />
            </label>
            <label>
              First name
              <Field name="first_name" />
              <ErrorMessage name="first_name" component="div" className="field-error" />
            </label>
            <label>
              Last name
              <Field name="last_name" />
              <ErrorMessage name="last_name" component="div" className="field-error" />
            </label>
            <label>
              Phone
              <Field name="phone_number" />
            </label>
            <label>
              Email
              <Field type="email" name="email" />
              <ErrorMessage name="email" component="div" className="field-error" />
            </label>
            <label>
              Job status
              <Field as="select" name="job_status">
                <option value="unemployed">Unemployed</option>
                <option value="has_interview">Has interview</option>
                <option value="employed">Employed</option>
              </Field>
              <ErrorMessage name="job_status" component="div" className="field-error" />
            </label>
            <button type="submit">Submit referral</button>
          </Form>
        </Formik>
      </section>

      <section className="card">
        <h2>Manage agencies & clients</h2>
        <div style={{ marginBottom: '16px' }}>
          <h3>Agencies</h3>
          {agencies.length === 0 ? (
            <p>No agencies registered.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {agencies.map((agency) => (
                <div key={agency.agency_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#fafafa' }}>
                  <span>{agency.agency_name}</span>
                  <button type="button" onClick={() => handleDeleteAgency(agency.agency_id, agency.agency_name)} style={{ backgroundColor: '#ee1000', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 12px', cursor: 'pointer' }}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Agency progress</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <label>
            Select agency
            <select value={selectedAgencyId} onChange={(e) => {
              const id = Number(e.target.value);
              setSelectedAgencyId(id);
              loadAgencyProgress(id);
            }}>
              <option value={0}>Choose agency</option>
              {agencies.map((agency) => (
                <option key={agency.agency_id} value={agency.agency_id}>{agency.agency_name}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => loadAgencyProgress(selectedAgencyId)} disabled={!selectedAgencyId}>
            Refresh progress
          </button>
        </div>

        {selectedAgencyId > 0 && agencyProgress.length === 0 ? (
          <p>No progress data available for this agency.</p>
        ) : null}

        {agencyProgress.length > 0 && (
          <div>
            <div className="card" style={{ padding: '16px', marginBottom: '12px', borderColor: '#d1d5db' }}>
              <strong>Summary</strong>
              <p>Total clients: {agencyProgress.length}</p>
              <p>Total appointments: {agencyProgress.reduce((sum, client) => sum + client.appointments.length, 0)}</p>
              <p>Completed: {agencyProgress.reduce((sum, client) => sum + client.appointments.filter((appt: any) => appt.status === 'completed').length, 0)}</p>
            </div>
            {agencyProgress.map((client) => (
              <div key={client.client_id} className="card" style={{ padding: '16px', marginBottom: '12px', borderColor: '#d1d5db' }}>
                <strong>{client.name}</strong> ({client.job_status})
                <ul className="list">
                  {client.appointments.map((appt: any) => (
                    <li key={appt.appt_id}>
                      {appt.service_type} on {appt.schedule_time || 'unassigned'} — {appt.status}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default PartnerDashboard;
