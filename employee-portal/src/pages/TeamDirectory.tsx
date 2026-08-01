import React, { useEffect, useState } from 'react';
import api from '../services/api';
import * as styles from '../styles/common';

interface TeamMember {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  job_title?: string;
  department?: string;
  photo_url?: string;
}

export default function TeamDirectory() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [filteredTeam, setFilteredTeam] = useState<TeamMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTeam(); }, []);
  useEffect(() => { filterTeam(); }, [searchQuery, selectedDepartment, team]);

  const loadTeam = async () => {
    try {
      const response = await api.get('/self-service/team');
      setTeam(response.data.team || []);
    } catch (error) {
      console.error('Failed to load team:', error);
      setTeam([]);
    } finally {
      setLoading(false);
    }
  };

  const filterTeam = () => {
    let filtered = team;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(m => m.first_name.toLowerCase().includes(q) || m.last_name.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q) || m.job_title?.toLowerCase().includes(q));
    }
    if (selectedDepartment !== 'all') filtered = filtered.filter(m => m.department === selectedDepartment);
    setFilteredTeam(filtered);
  };

  const departments = ['all', ...Array.from(new Set(team.map(m => m.department).filter(Boolean)))];
  const getInitials = (fn: string, ln: string) => `${fn.charAt(0)}${ln.charAt(0)}`.toUpperCase();

  if (loading) {
    return (
      <div style={styles.pageContainer}>
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner}></div>
          <p style={{ color: styles.colors.textSecondary }}>Loading team directory...</p>
        </div>
        <style>{styles.spinKeyframes}</style>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>Team Directory</h1>
        <p style={styles.pageSubtitle}>Find and connect with your colleagues</p>
      </div>

      {/* Search */}
      <div style={{ ...styles.card, padding: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <svg width="20" height="20" fill="none" stroke={styles.colors.textMuted} viewBox="0 0 24 24" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search by name, email, or job title..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ ...styles.formInput, paddingLeft: '2.75rem' }} />
          </div>
          <select value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)} style={styles.formSelect}>
            <option value="all">All Departments</option>
            {departments.filter(d => d !== 'all').map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <p style={{ fontSize: '0.875rem', color: styles.colors.textMuted, marginBottom: '1rem' }}>
        Showing {filteredTeam.length} of {team.length} team members
      </p>

      {filteredTeam.length === 0 ? (
        <div style={{ ...styles.card, ...styles.emptyState }}>
          <svg style={styles.emptyStateIcon} width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <h3 style={styles.emptyStateTitle}>No team members found</h3>
          <p style={styles.emptyStateText}>Try adjusting your search or filters</p>
        </div>
      ) : (
        <div style={styles.grid3}>
          {filteredTeam.map((member) => (
            <div key={member.id} style={styles.card} className="hover-card">
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: styles.colors.gradientPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: 'white', fontWeight: 600, fontSize: '1.1rem' }}>{getInitials(member.first_name, member.last_name)}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontWeight: 600, color: styles.colors.textPrimary, marginBottom: '0.25rem' }}>{member.first_name} {member.last_name}</h3>
                  <p style={{ fontSize: '0.8rem', color: styles.colors.textMuted, marginBottom: '0.75rem' }}>{member.employee_number}</p>

                  {member.job_title && (
                    <div style={{ ...styles.flexStart, fontSize: '0.8rem', color: styles.colors.textSecondary, marginBottom: '0.25rem' }}>
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      <span style={{ marginLeft: '0.5rem' }}>{member.job_title}</span>
                    </div>
                  )}
                  {member.department && (
                    <div style={{ ...styles.flexStart, fontSize: '0.8rem', color: styles.colors.textSecondary, marginBottom: '0.25rem' }}>
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                      <span style={{ marginLeft: '0.5rem' }}>{member.department}</span>
                    </div>
                  )}
                  {member.email && (
                    <a href={`mailto:${member.email}`} style={{ ...styles.flexStart, fontSize: '0.8rem', color: styles.colors.primary, textDecoration: 'none', marginBottom: '0.25rem' }}>
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      <span style={{ marginLeft: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.email}</span>
                    </a>
                  )}
                  {member.phone && (
                    <a href={`tel:${member.phone}`} style={{ ...styles.flexStart, fontSize: '0.8rem', color: styles.colors.primary, textDecoration: 'none' }}>
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      <span style={{ marginLeft: '0.5rem' }}>{member.phone}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`${styles.spinKeyframes} .hover-card:hover { transform: translateY(-2px); box-shadow: ${styles.shadows.cardHover}; }`}</style>
    </div>
  );
}
