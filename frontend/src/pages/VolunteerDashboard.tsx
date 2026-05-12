import { useEffect, useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import toast from 'react-hot-toast';
import { createVolunteer, getPendingAppointments, getVolunteerTasks, getVolunteers, assignAppointment, deleteVolunteer } from '../api';

interface AvailabilitySlot {
  date: Date;
  start: string;
  end: string;
}

const volunteerSchema = Yup.object({
  full_name: Yup.string().required('Volunteer name is required'),
  specialty: Yup.string(),
  availabilitySlots: Yup.array().of(
    Yup.object({
      date: Yup.date().required('Date is required'),
      start: Yup.string().required('Start time is required'),
      end: Yup.string().required('End time is required'),
    })
  ).min(1, 'Add at least one availability slot'),
});

const VolunteerDashboard = () => {
  const [volunteers, setVolunteers] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [selectedVolunteerId, setSelectedVolunteerId] = useState<number | null>(null);
  const [volunteerTasks, setVolunteerTasks] = useState<any[]>([]);

  useEffect(() => {
    loadVolunteers();
    loadPending();
  }, []);

  const loadVolunteers = async () => {
    try {
      const res = await getVolunteers();
      setVolunteers(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadPending = async () => {
    try {
      const res = await getPendingAppointments();
      setPending(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadVolunteerTasks = async (volunteerId: number) => {
    if (!volunteerId) {
      setVolunteerTasks([]);
      return;
    }
    try {
      const res = await getVolunteerTasks(volunteerId);
      setVolunteerTasks(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAssign = async (apptId: number, volunteerId: number) => {
    try {
      await assignAppointment(apptId, volunteerId);
      toast.success('Appointment assigned successfully!');
      loadPending();
      if (selectedVolunteerId === volunteerId) {
        loadVolunteerTasks(volunteerId);
      }
    } catch (error) {
      toast.error('Failed to assign appointment. Please try again.');
    }
  };

  const handleDeleteVolunteer = async (volunteerId: number) => {
    if (window.confirm('Are you sure you want to delete this volunteer? All associated appointments will be removed.')) {
      try {
        await deleteVolunteer(volunteerId);
        toast.success('Volunteer deleted successfully!');
        setSelectedVolunteerId(null);
        setVolunteerTasks([]);
        loadVolunteers();
      } catch (error) {
        toast.error('Failed to delete volunteer. Please try again.');
      }
    }
  };

  return (
    <div className="panel">
      <h1>Volunteer Dashboard</h1>
      <p>Register volunteer availability and assign pending appointments.</p>

      <section className="card">
        <h2>Volunteer registration</h2>
        <Formik
          initialValues={{
            full_name: '',
            specialty: '',
            availabilitySlots: [] as AvailabilitySlot[],
            newSlotDate: '',
            newSlotStart: '09:00',
            newSlotEnd: '17:00',
          }}
          validationSchema={volunteerSchema}
          onSubmit={async (values, { resetForm }) => {
            try {
              // Convert form values to availability pattern
              const availability_pattern = values.availabilitySlots.map(slot => ({
                date: slot.date.toISOString().split('T')[0], // Format as YYYY-MM-DD
                start: slot.start,
                end: slot.end,
              }));

              const payload = {
                full_name: values.full_name,
                specialty: values.specialty,
                availability_pattern,
              };
              const res = await createVolunteer(payload);
              toast.success(res.data.message || 'Volunteer registered successfully!');
              resetForm();
              loadVolunteers();
            } catch (error) {
              toast.error('Failed to register volunteer. Please try again.');
            }
          }}
        >
          {({ values, setFieldValue }) => (
            <Form className="form-grid">
              <label>
                Name
                <Field name="full_name" />
                <ErrorMessage name="full_name" component="div" className="field-error" />
              </label>
              <label>
                Specialty
                <Field name="specialty" />
              </label>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Available Dates & Times
                  <ErrorMessage name="availabilitySlots" component="div" className="field-error" />
                </label>

                {/* Display existing slots */}
                {values.availabilitySlots.map((slot, index) => (
                  <div key={index} style={{ marginBottom: '12px', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <strong>{new Date(slot.date).toLocaleDateString()}</strong>
                      <button
                        type="button"
                        onClick={() => {
                          const newSlots = values.availabilitySlots.filter((_, i) => i !== index);
                          setFieldValue('availabilitySlots', newSlots);
                        }}
                        style={{ backgroundColor: '#ee1000', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer' }}
                      >
                        Remove
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <label>
                        Start:
                        <Field
                          type="time"
                          name={`availabilitySlots[${index}].start`}
                          style={{ marginLeft: '4px' }}
                        />
                      </label>
                      <label>
                        End:
                        <Field
                          type="time"
                          name={`availabilitySlots[${index}].end`}
                          style={{ marginLeft: '4px' }}
                        />
                      </label>
                      <ErrorMessage name={`availabilitySlots[${index}].start`} component="div" className="field-error" />
                      <ErrorMessage name={`availabilitySlots[${index}].end`} component="div" className="field-error" />
                    </div>
                  </div>
                ))}

                {/* Add new slot */}
                <div style={{ marginTop: '16px', padding: '12px', border: '2px dashed #ddd', borderRadius: '4px' }}>
                  <h4>Add New Availability Slot</h4>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label>
                      Date:
                      <Field
                        type="date"
                        name="newSlotDate"
                        style={{ marginLeft: '4px' }}
                      />
                    </label>
                    <label>
                      Start Time:
                      <Field
                        type="time"
                        name="newSlotStart"
                        style={{ marginLeft: '4px' }}
                      />
                    </label>
                    <label>
                      End Time:
                      <Field
                        type="time"
                        name="newSlotEnd"
                        style={{ marginLeft: '4px' }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const newSlot = {
                          date: new Date(values.newSlotDate),
                          start: values.newSlotStart,
                          end: values.newSlotEnd,
                        };
                        if (values.newSlotDate && values.newSlotStart && values.newSlotEnd) {
                          setFieldValue('availabilitySlots', [...values.availabilitySlots, newSlot]);
                          setFieldValue('newSlotDate', '');
                          setFieldValue('newSlotStart', '');
                          setFieldValue('newSlotEnd', '');
                        }
                      }}
                      style={{ backgroundColor: '#ee1000', color: 'white', border: 'none', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer' }}
                    >
                      Add Slot
                    </button>
                  </div>
                </div>
              </div>

              <button type="submit">Add volunteer</button>
            </Form>
          )}
        </Formik>
      </section>

      <section className="card">
        <h2>Volunteer tasks</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <label>
            Select volunteer
            <select value={selectedVolunteerId ?? 0} onChange={(e) => {
              const id = Number(e.target.value);
              setSelectedVolunteerId(id);
              loadVolunteerTasks(id);
            }}>
              <option value={0}>Choose volunteer</option>
              {volunteers.map((vol) => (
                <option key={vol.volunteer_id} value={vol.volunteer_id}>{vol.full_name}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => { loadVolunteers(); loadPending(); if (selectedVolunteerId) loadVolunteerTasks(selectedVolunteerId); }}>
            Refresh lists
          </button>
          {selectedVolunteerId && (
            <button 
              type="button" 
              onClick={() => handleDeleteVolunteer(selectedVolunteerId)}
              style={{ backgroundColor: '#ee1000', color: 'white', border: 'none', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer' }}
            >
              Delete Volunteer
            </button>
          )}
        </div>

        <h3>Pending assignment queue</h3>
        {pending.length === 0 ? (
          <p>No pending appointments available.</p>
        ) : (
          <ul className="list">
            {pending.map((appt) => (
              <li key={appt.appt_id}>
                <div>
                  <strong>{appt.service_type}</strong> for {appt.first_name} {appt.last_name} on {appt.schedule_time || 'pending'}
                </div>
                <div>
                  <button disabled={!selectedVolunteerId} onClick={() => selectedVolunteerId && handleAssign(appt.appt_id, selectedVolunteerId)}>
                    Claim for selected volunteer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {selectedVolunteerId && (
          <div style={{ marginTop: '16px' }}>
            <h3>Tasks for selected volunteer</h3>
            {volunteerTasks.length === 0 ? (
              <p>No tasks assigned yet.</p>
            ) : (
              <ul className="list">
                {volunteerTasks.map((task) => (
                  <li key={task.appt_id}>
                    {task.service_type} for {task.first_name} {task.last_name} on {task.schedule_time || 'pending'} — {task.status}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default VolunteerDashboard;
