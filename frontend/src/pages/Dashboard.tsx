import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getDashboardStats, getAgencyStats, getClientProgress } from '../api';

type DashboardStats = {
  total_clients: number;
  completed_appointments: number;
  pending_confirmations: number;
  total_volunteers: number;
};

type AgencyStats = {
  agency_id: number;
  agency_name: string;
  category: string;
  client_count: number;
  status: number;
};

type ClientProgressRow = {
  client_id: number;
  client_name: string;
  agency_name: string;
  has_appointment: boolean;
  career_training: boolean;
  styling: boolean;
  interview_completed: boolean;
  feedback: boolean;
};

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [agencyStats, setAgencyStats] = useState<AgencyStats[]>([]);
  const [clientProgress, setClientProgress] = useState<ClientProgressRow[]>([]);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [statsRes, agencyRes, clientRes] = await Promise.all([
          getDashboardStats(),
          getAgencyStats(),
          getClientProgress(),
        ]);
        setStats(statsRes.data);
        setAgencyStats(agencyRes.data);
        setClientProgress(clientRes.data);
      } catch (error) {
        console.error(error);
        toast.error('Unable to load dashboard data. Please try again later.');
      }
    };

    loadStats();
  }, []);

  return (
    <section className="card">
      <h1>Dashboard</h1>
      <p>View current appointment progress and system metrics.</p>

      {!stats ? (
        <p>Loading data…</p>
      ) : (
        <>
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div style={{ background: '#fde5eb', padding: '16px', borderRadius: '12px', border: '1px solid #ffbfd4' }}>
              <h3>Registered Clients</h3>
              <p style={{ fontSize: '2rem', margin: 0 }}>{stats.total_clients}</p>
            </div>
            <div style={{ background: '#ffe7f0', padding: '16px', borderRadius: '12px', border: '1px solid #ffbfd4' }}>
              <h3>Completed Appointments</h3>
              <p style={{ fontSize: '2rem', margin: 0 }}>{stats.completed_appointments}</p>
            </div>
            <div style={{ background: '#ffd7e4', padding: '16px', borderRadius: '12px', border: '1px solid #ffbfd4' }}>
              <h3>Pending Confirmations</h3>
              <p style={{ fontSize: '2rem', margin: 0 }}>{stats.pending_confirmations}</p>
            </div>
            <div style={{ background: '#ffeef4', padding: '16px', borderRadius: '12px', border: '1px solid #ffbfd4' }}>
              <h3>Total Volunteers</h3>
              <p style={{ fontSize: '2rem', margin: 0 }}>{stats.total_volunteers}</p>
            </div>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <h2>Client Progress Board</h2>
            {clientProgress.length === 0 ? (
              <p>No client progress data available</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#fde5eb' }}>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ffbfd4' }}>Client</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #ffbfd4' }}>Booked</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #ffbfd4' }}>Career Training</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #ffbfd4' }}>Styling</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #ffbfd4' }}>Interview Completed</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #ffbfd4' }}>Client Feedback</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ffbfd4' }}>Referral Agency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientProgress.map((row) => (
                      <tr key={row.client_id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '12px' }}>{row.client_name}</td>
                        {['has_appointment', 'career_training', 'styling', 'interview_completed', 'feedback'].map((key) => (
                          <td key={key} style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: row[key as keyof ClientProgressRow] ? '#d63384' : '#999999' }}>
                            {row[key as keyof ClientProgressRow] ? 'Yes' : 'No'}
                          </td>
                        ))}
                        <td style={{ padding: '12px' }}>{row.agency_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ marginTop: '2rem' }}>
            <h2>Agency Referral Statistics</h2>
            {agencyStats.length === 0 ? (
              <p>No agency data available</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#fde5eb' }}>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ffbfd4' }}>Agency Name</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ffbfd4' }}>Category</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #ffbfd4' }}>Referred Clients</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #ffbfd4' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agencyStats.map((agency) => (
                      <tr key={agency.agency_id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '12px' }}>{agency.agency_name}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            backgroundColor: '#ffe7f0',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.8rem'
                          }}>
                            {agency.category.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#d63384' }}>
                          {agency.client_count}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{
                            backgroundColor: agency.status === 1 ? '#d1ecf1' : '#f8d7da',
                            color: agency.status === 1 ? '#0c5460' : '#721c24',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.8rem'
                          }}>
                            {agency.status === 1 ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
};

export default Dashboard;
