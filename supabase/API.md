# KwikBridge LMS — REST API (ENH-09)

## Base URL

```
https://yioqaluxgqxsifclydmd.supabase.co/functions/v1/api
```

## Authentication

All endpoints (except `GET /products`) require a Bearer token:

```
Authorization: Bearer <supabase_jwt_token>
```

## Endpoints

### Products

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/products` | None | List active loan products |

### Customers

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/customers` | Staff/Borrower | List customers (borrowers see own only) |
| `GET` | `/customers/:id` | Staff/Borrower | Single customer detail |

### Applications

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/applications` | Staff/Borrower | List applications (filterable by `?status=`) |
| `POST` | `/applications` | Any auth | Create new application |
| `PUT` | `/applications/:id` | Staff (non-read-only) | Update application |

### Loans

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/loans` | Staff/Borrower | List loans (`?status=Active&stage=2`) |
| `GET` | `/loans/:id` | Staff/Borrower | Loan detail with payments |
| `POST` | `/loans/:id/payments` | Finance/LO/Admin | Record payment |

### Portfolio

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/portfolio/summary` | Staff (except Collections) | Portfolio KPIs |
| `GET` | `/portfolio/provisions` | Admin/Credit/Finance/Auditor | IFRS 9 provisions |

### Operations

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/eod/trigger` | Admin only | Trigger EOD batch processing |

## Pagination

```
GET /customers?page=2&limit=20
```

Response includes: `{ data: [...], page: 2, limit: 20 }`

## Example: Record Payment

```bash
curl -X POST \
  https://yioqaluxgqxsifclydmd.supabase.co/functions/v1/api/loans/LN-001/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 5000}'
```

Response:
```json
{
  "data": {
    "amount": 5000,
    "interest": 1208,
    "principal": 3792,
    "newBalance": 96208,
    "status": "Active"
  },
  "message": "Payment recorded"
}
```

## Deployment

```bash
supabase functions deploy api
```
