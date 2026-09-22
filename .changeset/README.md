# Changesets

`@packio/dieline` is the only published package in this repo (`packio-web` itself is
private and is never released from here). Every change to `packages/dieline` that other
repos would notice ships with a changeset:

```bash
pnpm changeset            # describe the change and pick patch/minor/major
pnpm changeset version    # apply it to the package version + CHANGELOG
pnpm changeset publish    # publish to GitHub Packages (CI, on main)
```

See `docs/adr/0007-dieline-package.md` for who owns the engine and what a breaking
change means for `packio-api`'s drawing service.
