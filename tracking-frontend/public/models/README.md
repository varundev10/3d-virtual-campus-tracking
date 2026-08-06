# Campus Model Assets

Place the Agisoft Metashape export here.

Recommended file:

```text
ucer-campus.glb
```

The frontend automatically attempts to load:

```text
/models/ucer-campus.glb
```

## Metashape Export Recommendation

- Prefer `GLB` / `glTF Binary` when possible.
- Keep textures embedded in the GLB.
- Use a decimated mesh for browser performance.
- Keep the model centered around the campus origin if possible.
- If the model appears too large, small, rotated, or offset, tune these values in `.env`:

```text
VITE_CAMPUS_MODEL_URL=/models/ucer-campus.glb
VITE_CAMPUS_MODEL_SCALE=1
VITE_CAMPUS_MODEL_X=0
VITE_CAMPUS_MODEL_Y=0
VITE_CAMPUS_MODEL_Z=0
VITE_CAMPUS_MODEL_ROTATION_X=0
VITE_CAMPUS_MODEL_ROTATION_Y=0
VITE_CAMPUS_MODEL_ROTATION_Z=0
```

OBJ files can be previewed, but GLB is better for a browser app because geometry and textures travel as one file.
