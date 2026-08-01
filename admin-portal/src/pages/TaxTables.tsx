import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

/**
 * Tax Tables Admin Page
 * 
 * Allows administrators to manage tax tables without code changes.
 */

interface TaxTable {
    id: string;
    country: string;
    tableType: string;
    taxYear: string;
    displayName: string;
    effectiveFrom: string;
    effectiveTo: string | null;
    status: 'DRAFT' | 'ACTIVE' | 'DEPRECATED';
    sourceRef: string | null;
    checksum: string;
    createdAt: string;
    data?: TaxTableData;
}

interface TaxTableData {
    brackets: Array<{ min: number; max: number | null; rate: number; base_amount: number }>;
    credits?: { tax_credit?: number };
    rebates?: { primary?: number; secondary?: number; tertiary?: number };
    thresholds?: { under65?: number; age65to74?: number; age75plus?: number };
}

interface PreviewResult {
    input: { monthlyIncome: number; annualIncome: number };
    calculation: { monthlyPaye: number; annualTaxAfterCredits: number; creditsApplied: number; rebatesApplied: number };
}

export default function TaxTables() {
    const navigate = useNavigate();
    const [tables, setTables] = useState<TaxTable[]>([]);
    const [selectedTable, setSelectedTable] = useState<TaxTable | null>(null);
    const [loading, setLoading] = useState(true);
    const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
    const [previewIncome, setPreviewIncome] = useState(25000);
    const [previewAge, setPreviewAge] = useState(30);
    const [filterCountry, setFilterCountry] = useState<string>('');
    const [filterStatus, setFilterStatus] = useState<string>('');

    useEffect(() => { loadTaxTables(); }, [filterCountry, filterStatus]);

    const loadTaxTables = async () => {
        setLoading(true);
        try {
            let url = '/admin/tax-tables?';
            if (filterCountry) url += `country=${filterCountry}&`;
            if (filterStatus) url += `status=${filterStatus}&`;
            const response = await api.get(url);
            setTables(response.data.data || []);
        } catch (error) {
            console.error('Failed to load tax tables:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadTableDetails = async (id: string) => {
        try {
            const response = await api.get(`/admin/tax-tables/${id}`);
            setSelectedTable(response.data.data);
            setPreviewResult(null);
        } catch (error) {
            console.error('Failed to load table details:', error);
        }
    };

    const handleActivate = async (id: string) => {
        if (!confirm('Activate this tax table?')) return;
        try {
            await api.post(`/admin/tax-tables/${id}/activate`);
            loadTaxTables();
            if (selectedTable?.id === id) loadTableDetails(id);
        } catch (error) { console.error('Failed to activate:', error); }
    };

    const handleDeprecate = async (id: string) => {
        if (!confirm('Deprecate this tax table?')) return;
        try {
            await api.post(`/admin/tax-tables/${id}/deprecate`);
            loadTaxTables();
            if (selectedTable?.id === id) loadTableDetails(id);
        } catch (error) { console.error('Failed to deprecate:', error); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this tax table?')) return;
        try {
            await api.delete(`/admin/tax-tables/${id}`);
            loadTaxTables();
            if (selectedTable?.id === id) setSelectedTable(null);
        } catch (error) { console.error('Failed to delete:', error); }
    };

    const handlePreview = async () => {
        if (!selectedTable) return;
        try {
            const response = await api.post('/admin/tax-tables/preview-calculation', {
                taxTableId: selectedTable.id,
                monthlyIncome: previewIncome,
                employeeAge: previewAge,
                payPeriodType: 'MONTHLY',
            });
            setPreviewResult(response.data.data);
        } catch (error) { console.error('Failed to preview:', error); }
    };

    // Country-aware currency formatting
    const formatCurrency = (amount: number, country?: string) => {
        const c = country || selectedTable?.country || 'ZA';
        if (c === 'LS') {
            // Lesotho uses Maloti (LSL) - format as M X,XXX.XX
            return 'M ' + new Intl.NumberFormat('en-LS', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
        }
        // South Africa uses Rand (ZAR)
        return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount || 0);
    };

    const getCurrencyLabel = () => selectedTable?.country === 'LS' ? 'LSL' : 'ZAR';
    const formatPercent = (rate: number) => `${(rate * 100).toFixed(0)}%`;

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'ACTIVE': return { bg: '#dcfce7', text: '#166534', border: '#86efac' };
            case 'DRAFT': return { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' };
            case 'DEPRECATED': return { bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db' };
            default: return { bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db' };
        }
    };

    const getCountryFlag = (country: string) => country === 'ZA' ? '🇿🇦' : country === 'LS' ? '🇱🇸' : '🌍';

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
                <div style={{ width: '48px', height: '48px', border: '4px solid #e5e7eb', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    return (
        <div style={{ padding: '24px', background: '#f9fafb', minHeight: 'calc(100vh - 64px)' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', padding: '10px', borderRadius: '12px', display: 'flex' }}>
                            <svg width="24" height="24" fill="none" stroke="white" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        </span>
                        Tax Tables Management
                    </h1>
                    <p style={{ color: '#6b7280', marginTop: '8px', fontSize: '15px' }}>Configure PAYE brackets, rebates, and credits without code changes</p>
                </div>
                <button
                    onClick={() => navigate('/admin/payroll/tax-tables/create')}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)' }}
                >
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Create Tax Table
                </button>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', padding: '16px', background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <select value={filterCountry} onChange={(e) => setFilterCountry(e.target.value)} style={{ padding: '10px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', color: '#374151', background: 'white', cursor: 'pointer' }}>
                    <option value="">🌍 All Countries</option>
                    <option value="ZA">🇿🇦 South Africa</option>
                    <option value="LS">🇱🇸 Lesotho</option>
                </select>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: '10px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', color: '#374151', background: 'white', cursor: 'pointer' }}>
                    <option value="">All Statuses</option>
                    <option value="ACTIVE">✅ Active</option>
                    <option value="DRAFT">📝 Draft</option>
                    <option value="DEPRECATED">📦 Deprecated</option>
                </select>
                <button onClick={loadTaxTables} style={{ padding: '10px 16px', background: '#f3f4f6', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#374151', fontSize: '14px' }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Refresh
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px' }}>
                {/* Tax Tables List */}
                <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}>
                        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#374151' }}>Tax Tables ({tables.length})</h2>
                    </div>
                    <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                        {tables.map((table) => {
                            const statusStyle = getStatusStyle(table.status);
                            const isSelected = selectedTable?.id === table.id;
                            return (
                                <div
                                    key={table.id}
                                    onClick={() => loadTableDetails(table.id)}
                                    style={{
                                        padding: '16px 20px',
                                        cursor: 'pointer',
                                        borderBottom: '1px solid #f3f4f6',
                                        background: isSelected ? '#eef2ff' : 'white',
                                        borderLeft: isSelected ? '3px solid #4f46e5' : '3px solid transparent',
                                        transition: 'all 0.15s ease',
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '20px' }}>{getCountryFlag(table.country)}</span>
                                                <span style={{ fontWeight: 600, color: '#111827', fontSize: '15px' }}>{table.displayName}</span>
                                            </div>
                                            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '13px' }}>{table.tableType} • {table.taxYear}</p>
                                        </div>
                                        <span style={{ padding: '4px 10px', background: statusStyle.bg, color: statusStyle.text, fontSize: '12px', fontWeight: 600, borderRadius: '20px', border: `1px solid ${statusStyle.border}` }}>
                                            {table.status}
                                        </span>
                                    </div>
                                    <p style={{ margin: '8px 0 0', color: '#9ca3af', fontSize: '12px' }}>
                                        Effective: {new Date(table.effectiveFrom).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                            );
                        })}
                        {tables.length === 0 && (
                            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                                <div style={{ width: '64px', height: '64px', margin: '0 auto 16px', background: '#f3f4f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg width="32" height="32" fill="none" stroke="#9ca3af" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                </div>
                                <p style={{ color: '#6b7280', margin: 0 }}>No tax tables found</p>
                                <p style={{ color: '#9ca3af', fontSize: '14px', margin: '4px 0 0' }}>Create one to get started</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Selected Table Details */}
                <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    {selectedTable ? (
                        <div style={{ padding: '24px' }}>
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid #f3f4f6' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ fontSize: '32px' }}>{getCountryFlag(selectedTable.country)}</span>
                                        <div>
                                            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#111827' }}>{selectedTable.displayName}</h2>
                                            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '14px' }}>Tax Year {selectedTable.taxYear} • {selectedTable.tableType}</p>
                                        </div>
                                    </div>
                                </div>
                                <span style={{ padding: '6px 14px', background: getStatusStyle(selectedTable.status).bg, color: getStatusStyle(selectedTable.status).text, fontSize: '13px', fontWeight: 600, borderRadius: '20px', border: `1px solid ${getStatusStyle(selectedTable.status).border}` }}>
                                    {selectedTable.status}
                                </span>
                            </div>

                            {/* Info Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                                <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '10px' }}>
                                    <p style={{ margin: 0, color: '#6b7280', fontSize: '12px', fontWeight: 500, textTransform: 'uppercase' }}>Effective From</p>
                                    <p style={{ margin: '4px 0 0', color: '#111827', fontWeight: 600, fontSize: '14px' }}>{new Date(selectedTable.effectiveFrom).toLocaleDateString('en-ZA')}</p>
                                </div>
                                <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '10px' }}>
                                    <p style={{ margin: 0, color: '#6b7280', fontSize: '12px', fontWeight: 500, textTransform: 'uppercase' }}>Effective To</p>
                                    <p style={{ margin: '4px 0 0', color: '#111827', fontWeight: 600, fontSize: '14px' }}>{selectedTable.effectiveTo ? new Date(selectedTable.effectiveTo).toLocaleDateString('en-ZA') : 'Ongoing'}</p>
                                </div>
                                <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '10px' }}>
                                    <p style={{ margin: 0, color: '#6b7280', fontSize: '12px', fontWeight: 500, textTransform: 'uppercase' }}>Source</p>
                                    <p style={{ margin: '4px 0 0', color: '#111827', fontWeight: 600, fontSize: '14px' }}>{selectedTable.sourceRef || 'N/A'}</p>
                                </div>
                                <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '10px' }}>
                                    <p style={{ margin: 0, color: '#6b7280', fontSize: '12px', fontWeight: 500, textTransform: 'uppercase' }}>Checksum</p>
                                    <p style={{ margin: '4px 0 0', color: '#111827', fontWeight: 600, fontSize: '12px', fontFamily: 'monospace' }}>{selectedTable.checksum?.slice(0, 12)}...</p>
                                </div>
                            </div>

                            {/* Tax Brackets */}
                            {selectedTable.data?.brackets && (
                                <div style={{ marginBottom: '24px' }}>
                                    <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 600, color: '#374151' }}>Tax Brackets</h3>
                                    <div style={{ borderRadius: '10px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                            <thead>
                                                <tr style={{ background: '#f9fafb' }}>
                                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Min Income</th>
                                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Max Income</th>
                                                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Rate</th>
                                                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Base Tax</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedTable.data.brackets.map((bracket, i) => (
                                                    <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                                                        <td style={{ padding: '12px 16px', color: '#111827' }}>{formatCurrency(bracket.min)}</td>
                                                        <td style={{ padding: '12px 16px', color: '#111827' }}>{bracket.max ? formatCurrency(bracket.max) : '∞'}</td>
                                                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                            <span style={{ padding: '4px 12px', background: '#eef2ff', color: '#4f46e5', borderRadius: '20px', fontWeight: 600 }}>{formatPercent(bracket.rate)}</span>
                                                        </td>
                                                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#111827', fontWeight: 500 }}>{formatCurrency(bracket.base_amount)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Rebates / Credits */}
                            {(selectedTable.data?.rebates || selectedTable.data?.credits) && (
                                <div style={{ marginBottom: '24px' }}>
                                    <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                                        {selectedTable.data?.rebates ? 'Age-Based Rebates' : 'Tax Credits'}
                                    </h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                                        {selectedTable.data?.rebates && (
                                            <>
                                                <div style={{ padding: '16px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                                                    <p style={{ margin: 0, color: '#166534', fontSize: '12px', fontWeight: 500 }}>Primary (Under 65)</p>
                                                    <p style={{ margin: '8px 0 0', color: '#166534', fontSize: '20px', fontWeight: 700 }}>{formatCurrency(selectedTable.data.rebates.primary || 0)}</p>
                                                </div>
                                                <div style={{ padding: '16px', background: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                                                    <p style={{ margin: 0, color: '#1e40af', fontSize: '12px', fontWeight: 500 }}>Secondary (65-74)</p>
                                                    <p style={{ margin: '8px 0 0', color: '#1e40af', fontSize: '20px', fontWeight: 700 }}>{formatCurrency(selectedTable.data.rebates.secondary || 0)}</p>
                                                </div>
                                                <div style={{ padding: '16px', background: '#faf5ff', borderRadius: '10px', border: '1px solid #e9d5ff' }}>
                                                    <p style={{ margin: 0, color: '#7c3aed', fontSize: '12px', fontWeight: 500 }}>Tertiary (75+)</p>
                                                    <p style={{ margin: '8px 0 0', color: '#7c3aed', fontSize: '20px', fontWeight: 700 }}>{formatCurrency(selectedTable.data.rebates.tertiary || 0)}</p>
                                                </div>
                                            </>
                                        )}
                                        {selectedTable.data?.credits && (
                                            <div style={{ padding: '16px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                                                <p style={{ margin: 0, color: '#166534', fontSize: '12px', fontWeight: 500 }}>Annual Tax Credit</p>
                                                <p style={{ margin: '8px 0 0', color: '#166534', fontSize: '20px', fontWeight: 700 }}>{formatCurrency(selectedTable.data.credits.tax_credit || 0)}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Preview Calculator */}
                            <div style={{ padding: '20px', background: 'linear-gradient(135deg, #eef2ff 0%, #faf5ff 100%)', borderRadius: '12px', marginBottom: '24px' }}>
                                <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: '#4f46e5' }}>🧮 PAYE Preview Calculator</h3>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: 500 }}>Monthly Income ({getCurrencyLabel()})</label>
                                        <input type="number" value={previewIncome} onChange={(e) => setPreviewIncome(Number(e.target.value))} style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', width: '140px', fontSize: '14px' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: 500 }}>Employee Age</label>
                                        <input type="number" value={previewAge} onChange={(e) => setPreviewAge(Number(e.target.value))} style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', width: '80px', fontSize: '14px' }} />
                                    </div>
                                    <button onClick={handlePreview} style={{ padding: '10px 20px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                                        Calculate
                                    </button>
                                </div>
                                {previewResult && (
                                    <div style={{ marginTop: '16px', padding: '16px', background: 'white', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '24px' }}>
                                        <div>
                                            <p style={{ margin: 0, color: '#6b7280', fontSize: '12px' }}>Monthly PAYE</p>
                                            <p style={{ margin: '4px 0 0', color: '#4f46e5', fontSize: '28px', fontWeight: 700 }}>{formatCurrency(previewResult.calculation.monthlyPaye)}</p>
                                        </div>
                                        <div style={{ height: '48px', width: '1px', background: '#e5e7eb' }}></div>
                                        <div>
                                            <p style={{ margin: 0, color: '#6b7280', fontSize: '12px' }}>Annual Tax</p>
                                            <p style={{ margin: '4px 0 0', color: '#374151', fontSize: '18px', fontWeight: 600 }}>{formatCurrency(previewResult.calculation.annualTaxAfterCredits)}</p>
                                        </div>
                                        {previewResult.calculation.rebatesApplied > 0 && (
                                            <>
                                                <div style={{ height: '48px', width: '1px', background: '#e5e7eb' }}></div>
                                                <div>
                                                    <p style={{ margin: 0, color: '#6b7280', fontSize: '12px' }}>Rebates Applied</p>
                                                    <p style={{ margin: '4px 0 0', color: '#166534', fontSize: '16px', fontWeight: 600 }}>{formatCurrency(previewResult.calculation.rebatesApplied)}</p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '12px', paddingTop: '16px', borderTop: '1px solid #f3f4f6' }}>
                                {selectedTable.status === 'DRAFT' && (
                                    <>
                                        <button onClick={() => handleActivate(selectedTable.id)} style={{ padding: '10px 20px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Activate
                                        </button>
                                        <button onClick={() => handleDelete(selectedTable.id)} style={{ padding: '10px 20px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                                    </>
                                )}
                                {selectedTable.status === 'ACTIVE' && (
                                    <button onClick={() => handleDeprecate(selectedTable.id)} style={{ padding: '10px 20px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Deprecate</button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#6b7280' }}>
                            <div style={{ width: '80px', height: '80px', background: '#f3f4f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                                <svg width="40" height="40" fill="none" stroke="#9ca3af" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                            </div>
                            <p style={{ margin: 0, fontSize: '16px', fontWeight: 500 }}>Select a tax table</p>
                            <p style={{ margin: '4px 0 0', fontSize: '14px' }}>Click on a table from the list to view details</p>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
}
