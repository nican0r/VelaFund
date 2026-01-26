# Cap Table Management Tool for Brazilian Companies

## Project Overview

Build a comprehensive cap table management platform designed specifically for Brazilian companies. The tool must handle both **Sociedade Limitada (Ltda.)** and **Sociedade Anônima (S.A.)** corporate structures, comply with Brazilian corporate law (Código Civil and Lei das S.A. - Law 6.404/76), and support the unique requirements of the Brazilian startup and investment ecosystem.

The platform uses an **on-chain cap table** for immutable record-keeping, with a user-friendly UI that mirrors the blockchain state. Users interact exclusively through the UI—all on-chain operations are handled automatically by the backend.

The system should implement the **Open Cap Table Coalition (OCT) standard format** wherever possible, adapting it as needed for Brazilian corporate structures and legal requirements.

**All UI pages and user-facing content must support both English and Portuguese (Brazil) languages.**

**All user flows must be documented in markdown format**, describing how each flow is expected to be executed, including step-by-step interactions, decision points, validation rules, and expected outcomes.

---

## Core Requirements

### 1. Shareholder Registry & Equity Tracking

#### 1.1 Shareholder Management
- Maintain complete shareholder records including:
  - Full legal name and CPF/CNPJ
  - Contact information and address
  - Nationality and tax residency
  - Ownership percentage and voting rights
  - Share/quota class breakdown
  - Acquisition date and cost basis
  - Ethereum wallet address (for on-chain identity linking)
- Support for both individual (pessoa física) and entity (pessoa jurídica) shareholders
- Track beneficial ownership where applicable
- Track foreign shareholders

#### 1.2 Equity Structure Support
- **Sociedade Limitada (Ltda.)**
  - Track quotas (cotas) and quota holders (quotistas)
  - Manage contrato social amendments
  - Handle pro-rata rights and transfer restrictions
  
- **Sociedade Anônima (S.A.)**
  - Ações ordinárias (common shares) with voting rights
  - Ações preferenciais (preferred shares) with customizable rights
  - Support for multiple share classes as defined in estatuto social
  - Livro de Registro de Ações Nominativas (registered share book) compliance
  - Differentiate between capital aberto and capital fechado

#### 1.3 Ownership History
- Complete audit trail of all ownership changes (immutable on-chain records)
- Point-in-time cap table snapshots
- Historical ownership percentages at any date

#### 1.4 Open Cap Table Standard Compliance
- Store cap table data in OCT-compatible JSON schema
- Map Brazilian share classes to OCT stock class definitions
- Adapt OCT transaction types to Brazilian legal requirements
- Export cap tables in OCT format for interoperability
- Align off-chain OCT data format with on-chain OCP smart contract state

---

### 2. On-Chain Cap Table Architecture

#### 2.1 Blockchain Layer
- **Use the Open Cap Table Protocol (OCP) smart contracts** as the foundation
  - Adapt OCP contracts as needed to accommodate Brazilian regulatory requirements (Ltda. quota structures, S.A. share classes, Brazilian-specific transfer restrictions)
  - Extend OCP contracts to support Brazilian investment instruments (Mútuo conversível, Contrato de Investimento-Anjo, MISTO/MAIS)
  - Maintain compatibility with OCP standard where possible for interoperability
- All equity transactions recorded immutably on-chain
- Cryptographic proof of ownership and transaction history
- Support for EVM-compatible networks (consider gas costs and finality)

#### 2.2 Admin Wallet Architecture
- **One admin wallet per company**, stored securely on the backend
- Admin wallets are Privy embedded wallets created programmatically for each company
- **Only admin wallets can mint/create shares** on the cap table smart contract
- All share creation transactions are submitted by the admin wallet on behalf of the company
- **Gas sponsorship via Privy** — all admin wallet transactions use the Privy app's gas sponsorship to cover transaction fees
- Admin wallet private keys never exposed to frontend or users
- Secure key management with appropriate access controls on backend

#### 2.3 UI Mirroring
- Backend syncs on-chain state to off-chain database for fast queries
- UI displays mirrored data with real-time sync status
- Users interact only through UI—no direct blockchain interaction required
- Clear indicators when data is being synced or pending confirmation

#### 2.4 Transaction Flow
1. User initiates action in UI (e.g., share transfer, new issuance)
2. Backend validates business rules and compliance
3. Backend submits transaction to blockchain
4. Transaction confirmed on-chain
5. Backend updates mirrored database
6. UI reflects updated state

#### 2.5 Data Integrity
- Reconciliation checks between on-chain and off-chain data
- Alerts for any discrepancies
- On-chain data is source of truth for all equity records

---

### 3. Transaction Management

#### 3.1 Supported Transaction Types
- **Issuances**: New share/quota creation
- **Transfers**: Share sales, gifts, inheritance
- **Conversions**: Preferred to common, convertible instrument conversion
- **Stock splits and reverse splits**
- **Share cancellations and buybacks**
- **Capital increases and reductions**

#### 3.2 Transaction Processing
- Validate transactions against bylaws/operating agreement restrictions
- Calculate and display dilution impact
- Generate required documentation automatically
- Support batch transactions for complex restructurings
- All transactions recorded on-chain for immutability

#### 3.3 Transfer Restrictions
- Enforce right of first refusal (direito de preferência)
- Track lock-up periods
- Validate against shareholder agreement restrictions
- Support board/shareholder approval workflows

---

### 4. Investment Instruments & Round Management

#### 4.1 Supported Instruments

##### Mútuo Conversível (Convertible Loan)
- Principal amount and interest rate (respecting Brazilian usury limits)
- Conversion triggers and mechanics:
  - Qualified financing threshold
  - Maturity conversion
  - Change of control
- Discount rate for conversion
- Valuation cap
- Maturity date and repayment terms
- Pro-rata rights on future rounds

##### Contrato de Investimento-Anjo (Complementary Law 155/2016)
- Investment amount and terms
- Minimum holding period (per law requirements)
- Conversion rights after minimum period
- Redemption mechanics and timeline
- Remuneration structure during investment period
- Exit participation terms

##### MISTO + MAIS Templates
- Full support for MISTO investment agreement templates
- MAIS (Modelo de Acordo de Investimento Simplificado) implementation
- Pre-configured terms matching standard MISTO/MAIS structures
- Customizable fields for deal-specific modifications
- Automatic calculation of conversion scenarios

##### Direct Equity Purchases
- Standard share/quota subscription
- Capital increase documentation

#### 4.2 Funding Round Management
- Create and track funding rounds with:
  - Round name, type (Seed, Series A, etc.)
  - Target raise amount
  - Pre-money and post-money valuation
  - Price per share/quota
  - Closing date(s)
  
- Pro-forma cap table modeling before closing
- Track multiple closes within a round
- Side letter management

#### 4.3 Dilution Modeling
- Model future rounds with assumptions
- Show dilution impact on each shareholder
- Option pool impact analysis
- Anti-dilution adjustment calculations (weighted average, full ratchet)

#### 4.4 Convertible Instrument Tracking
- Dashboard showing all outstanding convertibles
- Conversion scenario modeling at various valuations
- Automatic conversion processing when triggers are met
- Impact on fully-diluted cap table

---

### 5. Exit Modeling

#### 5.1 Liquidation Preferences
- Model participating and non-participating preferred
- Multiple liquidation preference (1x, 2x, etc.)
- Seniority stacking across series

#### 5.2 Exit Scenarios
- Model exits at various valuations
- Calculate per-share proceeds by class
- Show breakeven analysis
- Account for:
  - Liquidation preferences
  - Catch-up provisions
  - Redemption rights
  - Tag-along rights
  - Drag-along rights
  - Management/Founder carve-out (bonus pool separate from equity)
  - IPO provisions (automatic conversion, lock-up periods)

#### 5.3 Distribution Waterfall
- Step-by-step visualization of proceeds distribution
- Comparison across exit values
- Sensitivity analysis

---

### 6. Employee Equity & Stock Options

#### 6.1 Option Plan Management (Plano de Opção de Compra de Ações)
- Create and manage multiple option pools
- Track pool utilization and remaining availability
- Board-approved pool limits

#### 6.2 Individual Grants
- Grant date and vesting start date
- Number of options/shares
- Exercise price (strike price)
- Vesting schedule:
  - Cliff period (typically 1 year)
  - Vesting frequency (monthly, quarterly, annually)
  - Total vesting period (typically 4 years)
- Acceleration triggers (single/double trigger)
- Expiration date

#### 6.3 Vesting Tracking
- Calculate vested vs unvested at any date
- Track exercises and remaining options
- Handle termination scenarios:
  - Voluntary resignation
  - Termination with/without cause (justa causa)
  - Death or disability
- Post-termination exercise windows

#### 6.4 Option Exercises
- Process exercises with payment tracking
- Calculate and flag tax implications
- Generate exercise documentation
- Update cap table automatically (recorded on-chain)

---

### 7. Brazilian Regulatory Compliance

#### 7.1 Corporate Structure Compliance
- Support for companies under standard corporate law
- Proper handling of Ltda. and S.A. requirements
- Shareholder agreement enforcement


---

### 8. Document Management

#### 8.1 Automated Document Generation

##### Template-Based Document Creation
- Documents are generated from underlying legal templates
- Users fill documents by selecting components in the UI that correspond to contract fields
- UI presents structured forms with dropdowns, toggles, and inputs mapped to template variables
- Real-time document preview as users make selections
- Validation ensures all required fields are completed before generation
- Generated documents maintain legal compliance while allowing customization within defined parameters

##### Supported Document Templates
- Share/quota certificates
- Atas de assembleia (shareholder meeting minutes)
- Atas de reunião de diretoria (board meeting minutes)
- Alterações contratuais (Ltda. amendments)
- Acordos de acionistas (shareholder agreements)
- Option grant letters
- Exercise notices
- Transfer agreements
- Investor rights agreements
- Mútuo conversível agreements
- Contrato de Investimento-Anjo
- MISTO/MAIS investment agreements

#### 8.2 Digital Signatures

##### Primary: Ethereum Wallet Signatures via Privy
- Embedded wallet creation for all users via Privy
- Document signing using Ethereum signatures (EIP-712 typed data)
- Signature verification and storage
- Link signatures to on-chain identity
- No crypto knowledge required from users—seamless UX

##### Secondary: ICP-Brasil Integration (When Legally Required)
- Support for ICP-Brasil digital certificates (e-CPF, e-CNPJ) only for operations where Brazilian law specifically requires qualified digital signatures
- Integration with ICP-Brasil compliant signature providers (Clicksign, D4Sign, DocuSign) as fallback
- Certificate validation for required documents
- Clear indication to users when ICP-Brasil signature is legally mandated

##### Signature Workflow
1. Document generated from template
2. Parties notified for signature
3. Users sign via Privy embedded wallet (default)
4. If ICP-Brasil required, redirect to qualified signature flow
5. All signatures recorded and linked to document
6. Signed document hash stored on-chain for verification

#### 8.3 Document Storage
- Secure document repository
- Version control for all documents
- Access control by role/permission
- Search and retrieval functionality
- Document hashes anchored on-chain for tamper-proof verification

---

### 9. Reporting & Analytics

#### 9.1 Cap Table Reports
- Current cap table with ownership percentages
- Fully-diluted cap table (including all options and convertibles)
- Point-in-time historical snapshots
- Ownership by share class
- Voting power distribution
- OCT-format export for interoperability

#### 9.2 Investor Reporting
- Ownership certificates
- Portfolio company updates
- Round participation summaries
- Exit proceeds projections

#### 9.3 Board Reporting
- Equity distribution dashboards
- Option pool utilization
- Dilution tracking over time
- Upcoming vesting events
- Convertible instruments outstanding

#### 9.4 Due Diligence Packages
- Export complete cap table history
- Transaction ledger (with on-chain verification links)
- Option grant summary
- Convertible instrument summary
- Shareholder contact list

#### 9.5 Export Formats
- PDF reports
- Excel/CSV exports
- OCT JSON format
- On-chain verification links for all transactions

---

### 10. User Management & Permissions

#### 10.1 Role-Based Access Control
- **Admin**: Full access to all features
- **Finance**: Cap table view, transaction entry, reporting
- **Legal**: Document management, compliance features
- **Investor**: Read-only access to relevant holdings
- **Employee**: View own grants and vesting
- Custom role creation

#### 10.2 User Authentication
- Privy-based authentication with embedded wallets
- Email/social login options (wallet created automatically)
- Two-factor authentication
- Session management and timeout policies

#### 10.3 Audit Trail
- Log only user actions relevant to Brazilian cap table audits:
  - Share/quota issuances, transfers, and cancellations
  - Shareholder record modifications
  - Investment instrument creation and conversion events
  - Option grants, vesting changes, and exercises
  - Document generation and signature events
  - Cap table export and report generation
  - User permission changes for cap table access
- Immutable audit records (on-chain for critical equity transactions)
- Export audit logs for compliance and due diligence

---

### 11. Communication & Notifications

#### 11.1 Email Notification System
- Automated email notifications for key events:
  - **Document signature requests**: Notify parties when documents require their signature
  - **Cap table changes**: Alert shareholders when transactions affect their ownership
  - **Funding round invitations**: Notify investors about participation opportunities in new rounds
  - **Vesting milestones**: Alert employees when they reach vesting milestones (e.g., cliff reached, 25% vested)
  - **Option exercise deadlines**: Remind option holders of upcoming expiration dates
  - **Transaction confirmations**: Confirm when on-chain transactions are completed
- Email templates for each notification type
- User email preferences and notification settings
- Unsubscribe functionality for non-critical notifications

---

### 12. Integrations

#### 12.1 Privy
- Embedded wallet infrastructure for user authentication
- **Admin wallet management** — backend-managed Privy embedded wallets for each company
- **Gas sponsorship** — all admin wallet transactions sponsored via Privy app
- User wallet creation and management
- Wallet recovery mechanisms

#### 12.2 Blockchain Infrastructure
- RPC provider integration
- Transaction monitoring and confirmation tracking
- Gas management and optimization

---

## Technical Requirements

### Architecture
- Modern web application (responsive design)
- Mobile-friendly interface
- Secure cloud hosting (consider Brazilian data residency requirements - LGPD)
- Blockchain node/RPC access for on-chain operations
- Event-driven sync between on-chain and off-chain data

### Security
- End-to-end encryption for sensitive data
- SOC 2 compliance considerations
- LGPD (Lei Geral de Proteção de Dados) compliance
- Two-factor authentication
- Session management and timeout policies
- Smart contract security audits

### Performance
- Support for cap tables with up to 500 shareholders
- Fast report generation
- Efficient handling of complex waterfall calculations
- Optimized blockchain sync with minimal latency

### Localization
- **Full bilingual support: Portuguese (Brazil) and English**
- All UI elements, labels, and messages translated
- Language toggle accessible from any page
- User language preference saved in profile
- Brazilian date formats (DD/MM/YYYY)
- Brazilian currency formatting (R$ X.XXX,XX)
- Support for USD and other currencies for international rounds

---

## Development Phases

### Phase 1: Core Cap Table (MVP)
- Shareholder registry (Ltda. and S.A.)
- Basic transaction management
- On-chain cap table using OCP smart contracts (adapted for Brazilian requirements)
- UI mirroring of blockchain state
- Simple reporting
- User authentication via Privy with embedded wallets
- Email notification system for key events
- Bilingual UI (PT-BR / EN)

### Phase 2: Investment Features
- Mútuo conversível implementation
- Contrato de Investimento-Anjo support
- MISTO + MAIS templates
- Round management
- Dilution modeling
- Waterfall analysis

### Phase 3: Employee Equity
- Option plan management
- Vesting tracking
- Exercise processing

### Phase 4: Compliance & Documents
- Document generation (all investment templates)
- Ethereum wallet signing via Privy
- ICP-Brasil integration for legally required signatures
- Regulatory compliance features
- OCT format export/import

---

## Success Metrics

- Accurate cap table calculations (100% accuracy required)
- On-chain and off-chain data consistency (zero discrepancies)
- Document generation time < 30 seconds
- Page load time < 2 seconds
- Blockchain sync latency < 30 seconds after confirmation

---

## References

- Lei 6.404/76 (Lei das S.A.)
- Código Civil Brasileiro (Sociedades Limitadas)
- Law 4.131/62 (Foreign Capital)
- Complementary Law 155/2016 (Investidor-Anjo)
- Law 14.063/2020 (Electronic Signatures)
- LGPD (Lei 13.709/2018)
- Open Cap Table Coalition Format Specification
- Open Cap Table Protocol (OCP) Smart Contracts
- EIP-712 (Typed structured data hashing and signing)
- Privy Documentation