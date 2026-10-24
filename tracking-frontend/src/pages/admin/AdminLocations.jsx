import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../layouts/AdminLayout.jsx';
import CampusMap from '../../components/CampusMap.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { ConfirmDialog, Modal } from '../../components/ui/Modal.jsx';
import { Field, SelectField, TextField } from '../../components/ui/Field.jsx';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { api } from '../../lib/api.js';
import { useAsync } from '../../lib/useAsync.js';
import { isLikelyInsideCampus } from '../../lib/campus.js';
import { formatCoordinate } from '../../lib/geo.js';
import { formatDateTime } from '../../lib/format.js';
import { LOCATION_CATEGORIES, categoryColor, categoryLabel, matchesSearch } from '../../lib/locationCategories.js';

const CODE_RE = /^[A-Z0-9][A-Z0-9-]{1,31}$/;
const NUMBER_RE = /^-?\d+(\.\d+)?$/;

function validate(values) {
  const errors = {};
  if (!CODE_RE.test(values.code)) errors.code = 'Use 2-32 uppercase letters, digits or hyphens (e.g. CSE-LAB-2)';
  if (!values.name.trim()) errors.name = 'Name is required';
  if (values.name.length > 120) errors.name = 'Name must be at most 120 characters';
  if (!values.category) errors.category = 'Choose a category';
  if (values.description.length > 1000) errors.description = 'Description must be at most 1000 characters';
  const lat = values.latitude.trim();
  const lng = values.longitude.trim();
  if (!NUMBER_RE.test(lat) || Math.abs(Number(lat)) > 90) errors.latitude = 'Latitude must be a decimal number between -90 and 90';
  if (!NUMBER_RE.test(lng) || Math.abs(Number(lng)) > 180) errors.longitude = 'Longitude must be a decimal number between -180 and 180';
  return errors;
}

function LocationFormModal({ open, location, onClose, onSaved }) {
  const toast = useToast();
  const editing = Boolean(location);
  const [values, setValues] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setValues(location ? {
      code: location.code,
      name: location.name,
      category: location.category,
      description: location.description ?? '',
      latitude: String(location.latitude),
      longitude: String(location.longitude),
    } : { code: '', name: '', category: '', description: '', latitude: '', longitude: '' });
  }, [open, location]);

  if (!values) return <Modal open={false} title="" onClose={onClose} />;

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: key === 'code' ? e.target.value.toUpperCase() : e.target.value }));
  const lat = Number(values.latitude);
  const lng = Number(values.longitude);
  const hasPoint = NUMBER_RE.test(values.latitude.trim()) && NUMBER_RE.test(values.longitude.trim());
  const outside = hasPoint && !isLikelyInsideCampus(lat, lng);

  const submit = async (event) => {
    event.preventDefault();
    const next = validate(values);
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const payload = {
      code: values.code,
      name: values.name.trim(),
      category: values.category,
      description: values.description.trim() || null,
      latitude: Number(values.latitude),
      longitude: Number(values.longitude),
    };
    try {
      const saved = editing
        ? await api.updateCampusLocation(location.id, payload)
        : await api.createCampusLocation(payload);
      toast.success(`${saved.name} ${editing ? 'updated' : 'added'}`);
      onSaved(saved);
    } catch (error) {
      setErrors({ ...error.fieldErrors, form: Object.keys(error.fieldErrors).length ? null : error.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={editing ? `Edit ${location.name}` : 'Add campus location'}
      onClose={onClose}
      size="lg"
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="location-form" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add location'}</button>
        </>
      )}
    >
      <form id="location-form" className="location-form" onSubmit={submit} noValidate>
        <div className="form-stack">
          <TextField id="loc-code" label="Code" value={values.code} onChange={set('code')} error={errors.code} disabled={editing}
            hint={editing ? 'Codes are fixed because 3D labels and records reference them.' : 'Shown on the 3D label, e.g. CSE-LAB-2'} maxLength={32} />
          <TextField id="loc-name" label="Name" value={values.name} onChange={set('name')} error={errors.name} maxLength={120} />
          <SelectField id="loc-category" label="Category" value={values.category} onChange={set('category')} error={errors.category}>
            <option value="">Choose a category</option>
            {LOCATION_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </SelectField>
          <Field id="loc-description" label="Description (optional)" error={errors.description}>
            {(a11y) => <textarea className="input" rows={3} maxLength={1000} {...a11y} value={values.description} onChange={set('description')} />}
          </Field>
          <div className="field-pair">
            <TextField id="loc-lat" label="Latitude" inputMode="decimal" value={values.latitude} onChange={set('latitude')} error={errors.latitude} placeholder="25.43050" />
            <TextField id="loc-lng" label="Longitude" inputMode="decimal" value={values.longitude} onChange={set('longitude')} error={errors.longitude} placeholder="81.77040" />
          </div>
          {outside && (
            <p className="form-warning" role="status"><Icon name="alert" size={16} /> These coordinates are outside the campus geofence. The point will be placed at the edge of the 3D scene.</p>
          )}
          {errors.form && <p className="form-error" role="alert">{errors.form}</p>}
        </div>
        <div className="picker-map">
          <p className="muted small">Click the map to set the coordinates.</p>
          <CampusMap
            pickedPoint={hasPoint ? { latitude: lat, longitude: lng } : null}
            onMapClick={(latlng) => setValues((v) => ({ ...v, latitude: latlng.lat.toFixed(6), longitude: latlng.lng.toFixed(6) }))}
            followCurrent={false}
            label="Map for choosing location coordinates"
          />
        </div>
      </form>
    </Modal>
  );
}

export default function AdminLocations() {
  const toast = useToast();
  const locations = useAsync(() => api.getCampusLocations(), []);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [editing, setEditing] = useState(null); // null = closed, {} = new, location = edit
  const [deleting, setDeleting] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const all = useMemo(() => locations.data ?? [], [locations.data]);
  const rows = useMemo(() => all.filter((l) => (!category || l.category === category) && matchesSearch(l, search)), [all, category, search]);

  const remove = async () => {
    try {
      await api.deleteCampusLocation(deleting.id);
      locations.setData((items) => items.filter((l) => l.id !== deleting.id));
      toast.success(`${deleting.name} removed`);
    } catch (error) {
      toast.error(`Could not remove location: ${error.message}`);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <AdminLayout
      title="Campus Locations"
      actions={<button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing({})}><Icon name="plus" size={16} /> Add location</button>}
    >
      <div className="split-layout">
        <section className="card">
          <div className="toolbar" role="search">
            <div className="search-input">
              <Icon name="search" />
              <input type="search" placeholder="Search name, code or description" aria-label="Search locations" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="input" aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {LOCATION_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          {locations.loading && !locations.data && <Spinner label="Loading locations" />}
          {locations.error && <ErrorState title="Could not load locations" message={locations.error.message} onRetry={locations.reload} />}
          {locations.data && all.length === 0 && (
            <EmptyState icon="building" title="No campus locations" action={<button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing({})}>Add the first location</button>}>
              Locations appear in the user 3D explorer and search once added.
            </EmptyState>
          )}
          {locations.data && all.length > 0 && rows.length === 0 && <EmptyState icon="search" title="No matches">Adjust the search or category filter.</EmptyState>}
          {rows.length > 0 && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Location</th>
                    <th scope="col">Category</th>
                    <th scope="col">Coordinates</th>
                    <th scope="col">Updated</th>
                    <th scope="col"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((l) => (
                    <tr key={l.id} className={l.id === selectedId ? 'selected' : ''} onClick={() => setSelectedId(l.id)}>
                      <td><strong>{l.name}</strong><br /><small className="mono muted">{l.code}</small></td>
                      <td><span className="category-tag"><span className="swatch" style={{ background: categoryColor(l.category) }} />{categoryLabel(l.category)}</span></td>
                      <td className="mono small">
                        {formatCoordinate(l.latitude)}, {formatCoordinate(l.longitude)}
                        {!isLikelyInsideCampus(l.latitude, l.longitude) && <><br /><span className="badge badge-warning">Outside geofence</span></>}
                      </td>
                      <td className="small">{formatDateTime(l.updatedAt)}</td>
                      <td className="actions">
                        <button type="button" className="icon-button" onClick={(e) => { e.stopPropagation(); setEditing(l); }} aria-label={`Edit ${l.name}`}><Icon name="edit" /></button>
                        <button type="button" className="icon-button danger" onClick={(e) => { e.stopPropagation(); setDeleting(l); }} aria-label={`Delete ${l.name}`}><Icon name="trash" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card map-card" aria-label="Locations map">
          <CampusMap places={rows} selectedPlaceId={selectedId} onSelectPlace={(p) => setSelectedId(p.id)} followCurrent={false} />
        </section>
      </div>

      <LocationFormModal
        open={editing !== null}
        location={editing?.id ? editing : null}
        onClose={() => setEditing(null)}
        onSaved={(saved) => {
          locations.setData((items) => {
            const exists = items.some((l) => l.id === saved.id);
            const next = exists ? items.map((l) => (l.id === saved.id ? saved : l)) : [...items, saved];
            return next.sort((a, b) => a.name.localeCompare(b.name));
          });
          setSelectedId(saved.id);
          setEditing(null);
        }}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete location?"
        message={deleting ? `${deleting.name} (${deleting.code}) will be removed from search, the map and the 3D explorer. Attendance records that mention this code are not changed.` : ''}
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </AdminLayout>
  );
}
