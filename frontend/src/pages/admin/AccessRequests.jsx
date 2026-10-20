import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client.js'
import Alert from '../../components/Alert.jsx'
import AsyncContent from '../../components/AsyncContent.jsx'
import { BackLink, DataTable, Field, FormActions, FormSection, PageHeader, Panel } from '../../components/AdminUI.jsx'
import { ROLES, formatDate } from '../../constants.js'
import useApi from '../../hooks/useApi.js'
import { requestColumns } from './columns.jsx'

// 13 Pending Access Requests
export function PendingRequests() {
  const { data, error, loading } = useApi(api.listUsers)
  const pending = (data ?? []).filter((user) => user.status === 'PENDING')

  return (
    <>
      <PageHeader title="Pending Access Requests" subtitle="Review and manage new user access requests." />

      <Panel title="PENDING ACCESS REQUESTS" className="page-panel">
        <AsyncContent loading={loading} error={error}>
          <DataTable
            columns={requestColumns}
            rows={pending}
            caption="Pending access requests"
            empty="No pending access requests."
          />
        </AsyncContent>
      </Panel>
    </>
  )
}

// 14 Review Access Request — approve (with a role) or reject. Either way the applicant is emailed.
export function ReviewRequest() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: request, error, loading } = useApi(() => api.getUser(id), [id])
  const [role, setRole] = useState('ACCOUNTANT')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)

  if (request && request.status !== 'PENDING' && !done) {
    return <Navigate to={`/admin/users/${request.id}`} replace />
  }

  const decide = async (decision) => {
    if (decision === 'reject' && !window.confirm(`Reject the access request from ${request.email_address}?`)) return
    setBusy(true)
    setActionError('')
    try {
      const result = decision === 'approve' ? await api.approveRequest(id, role) : await api.rejectRequest(id)
      setDone({ decision, ...result })
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    decide('approve')
  }

  return (
    <>
      <PageHeader title="Review Access Request" subtitle="Review applicant information and approve or reject access." />

      <Panel
        as="form"
        title="REQUEST DETAILS"
        className="page-panel panel--form"
        onSubmit={handleSubmit}
        action={<BackLink to="/admin/access-requests">Back to Requests</BackLink>}
      >
        <div className="form-body">
          <AsyncContent loading={loading} error={error}>
            {request && (
              <>
                <FormSection title="APPLICANT INFORMATION">
                  <Field label="FIRST NAME" value={request.first_name ?? ''} readOnly />
                  <Field label="LAST NAME" value={request.last_name ?? ''} readOnly />
                  <Field label="EMAIL ADDRESS" value={request.email_address ?? ''} readOnly />
                  <Field label="DATE OF BIRTH" value={formatDate(request.birth_date)} readOnly />
                  <Field label="ADDRESS" value={request.home_address ?? ''} readOnly title={request.home_address} />
                  <Field label="DATE REQUESTED" value={formatDate(request.created_at)} readOnly />
                </FormSection>

                {!done && (
                  <FormSection title="ACCESS">
                    <Field
                      label="ROLE IF APPROVED"
                      options={ROLES}
                      value={role}
                      onChange={(event) => setRole(event.target.value)}
                    />
                  </FormSection>
                )}

                <div className="form-feedback">
                  <Alert>{actionError}</Alert>
                  {done?.decision === 'approve' && (
                    <Alert tone="success">
                      Approved. Username <strong>{done.username}</strong> was created and a login link with a temporary
                      password was emailed to {request.email_address}.
                    </Alert>
                  )}
                  {done?.decision === 'reject' && (
                    <Alert tone="info">Request rejected. The applicant has been notified by email.</Alert>
                  )}
                </div>
              </>
            )}
          </AsyncContent>
        </div>

        <FormActions>
          {done ? (
            <button type="button" className="btn btn--primary btn--sm" title="Return to pending access requests" onClick={() => navigate('/admin/access-requests')}>
              Done
            </button>
          ) : (
            <>
              <button type="submit" className="btn btn--primary btn--sm" disabled={!request || busy} title="Approve this request and create the user">
                Approve
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                disabled={!request || busy}
                onClick={() => decide('reject')}
                title="Reject this access request"
              >
                Reject
              </button>
            </>
          )}
        </FormActions>
      </Panel>
    </>
  )
}
