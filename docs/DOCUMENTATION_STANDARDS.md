# Documentation Standards

**Version**: 1.0
**Last Updated**: 2026-04-06

This document defines the structure, format, and conventions for documentation in the pps190/frappe fork. The standards mirror those used in the pps190/next app — see `apps/next/docs/DOCUMENTATION_STANDARDS.md` for the full specification.

---

## Directory Structure

```
docs/
├── DOCUMENTATION_STANDARDS.md          <- this file
├── live/                               <- production features (shipped & in use)
│   └── remove-background/
│       ├── technical-guide.md
│       └── images/
└── planned/                            <- features in design or development
```

## Conventions

- **User guides** are not required for frappe-level changes since end users interact through the app layer (next, posb, etc.)
- **Technical guides** document framework-level features that other apps depend on
- All other format rules (headings, field names, screenshots, etc.) follow the next app's DOCUMENTATION_STANDARDS.md
