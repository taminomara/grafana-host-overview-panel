# Sorting

The Host Overview panel can sort both resources and groups. Resources are
sorted using type-aware ordering by default, while groups preserve the order
returned by the data source. Both can be configured independently.

## Sort modes

Sort mode is available in two places:

- **Resource-level** — under **Resource** > **Sort mode** (requires the ID field
  to be set). Controls the order of resources inside the innermost group.
- **Group-level** — inside each group's settings, under **Sort**. Controls the
  order of groups at that nesting level.

The available sort modes are:

| Sort mode | Description |
|-----------|-------------|
| **Disabled** | Keep the order returned by the data source. |
| **Default** | Type-aware: numeric sort for numbers, lexicographic for strings. |
| **Lexicographic** | Alphabetical sort, case-sensitive (`A` < `Z` < `a` < `z`). |
| **Lexicographic (case-insensitive)** | Alphabetical sort, ignoring case. |
| **Numeric** | Parse values as numbers and sort numerically. Non-numeric values fall back to lexicographic comparison. |
| **Custom** | Sort by regex capture groups (see below). |

## Custom sort patterns

When sort mode is set to **Custom**, a **Sort pattern** field appears. Enter a
regular expression with named capture groups. The panel extracts groups from
each value and sorts by them in priority order.

### Group name format

Each capture group name encodes how that part should be sorted:

| Prefix | Meaning |
|--------|---------|
| `n` | Sort the captured part **numerically**. |
| `s` | Sort the captured part as a **string** (case-sensitive). |
| `i` | Sort the captured part as a **string** (case-insensitive). |

| Suffix | Meaning |
|--------|---------|
| `a` | **Ascending** order (default if omitted). |
| `d` | **Descending** order. |

| Number | Meaning |
|--------|---------|
| digit(s) | **Priority** — lower numbers are compared first. If omitted, groups are compared in the order they appear in the pattern. |

### Examples

**Sort server names like `web-3`, `web-12`, `db-1` by the numeric suffix:**

```
\w+-(?<n1>\d+)
```

This extracts a single numeric group (`n1`). `web-3` sorts before `web-12`
because the captured values `3` and `12` are compared numerically.

**Sort rack-shelf identifiers like `rack-3-shelf-12` by rack first, then shelf:**

```
rack-(?<n1>\d+)-shelf-(?<n2>\d+)
```

Two numeric groups: `n1` (rack number, priority 1) and `n2` (shelf number,
priority 2). `rack-2-shelf-15` sorts before `rack-3-shelf-1`.

**Sort hostnames like `us-west-prod-07` by region (string), then environment
(string), then number (numeric):**

```
(?<s1>[a-z]+-[a-z]+)-(?<s2>[a-z]+)-(?<n3>\d+)
```

Three groups: `s1` (region, string, priority 1), `s2` (env, string, priority 2),
`n3` (number, numeric, priority 3).

**Sort in descending order — most recent version first:**

```
v(?<nd1>\d+)\.(?<nd2>\d+)
```

Two numeric-descending groups: `nd1` (major version) and `nd2` (minor version).
`v2.1` sorts before `v1.9`.

**Case-insensitive string sort with explicit priority:**

```
(?<i2>[A-Za-z]+)-(?<n1>\d+)
```

Here `n1` has priority 1 and `i2` has priority 2, so items are sorted by the
numeric part first, then by the string part (case-insensitive) as a tiebreaker.

### How non-matching values are handled

Values that don't match the regex pattern are sorted **after** all matching
values, using the Default sort mode as a fallback.
