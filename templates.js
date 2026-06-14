/* ==========================================================================
   RETRO DFD VISUALIZER - TEMPLATE REGISTRY
   ========================================================================== */

const TemplateRegistry = {
    atm: `# Entities
Cust[Customer]
Bank[Bank Mainframe]

# Processes
Auth(Authenticate User)
Trans(Process Transaction)
Query(Inquire Balance)

# Stores
DB|Accounts Database|

# Flows
Cust -> Auth : Card & PIN
Auth -> Cust : Access Screen
Cust -> Trans : Withdrawal Request
Trans -> Bank : Request Auth
Bank -> Trans : Auth Approved
Trans -> DB : Debit Account
Cust -> Query : Balance Inquiry
DB -> Query : Read Balance
Query -> Cust : Balance Slip

# Positions
Cust: 80, 220
Auth: 280, 120
Trans: 280, 320
Query: 280, 480
Bank: 480, 320
DB: 480, 120
`,

    ecom: `# Entities
Buyer[Online Customer]
Gateway[Payment Gateway]
Fulfill[Warehouse API]

# Processes
Checkout(Checkout Order)
Inventory(Update Stock)
Ship(Fulfill Delivery)

# Stores
Orders|Orders Database|
Stock|Inventory Database|

# Flows
Buyer -> Checkout : Cart & Payment Info
Checkout -> Gateway : Charge Customer
Gateway -> Checkout : Payment Confirmed
Checkout -> Orders : Save Order Record
Checkout -> Inventory : Deduct Items
Inventory -> Stock : Update Stock Count
Orders -> Ship : Retrieve Order
Ship -> Fulfill : Dispatch Request

# Positions
Buyer: 80, 160
Checkout: 280, 160
Gateway: 280, 320
Inventory: 480, 160
Stock: 660, 160
Orders: 280, 480
Ship: 480, 480
Fulfill: 660, 480
`,

    library: `# Entities
Member[Library Patron]
Staff[Librarian]

# Processes
Checkout(Lend Book)
Return(Process Return)
Alert(Send Fine Notices)

# Stores
Books|Books Catalog|
Loans|Loan Registry|

# Flows
Member -> Checkout : Book Barcode
Checkout -> Books : Verify Availability
Books -> Checkout : Status: In Library
Checkout -> Loans : Log Active Loan
Member -> Return : Return Book
Return -> Loans : Update Loan (Returned)
Loans -> Alert : Scan Overdue Loans
Alert -> Member : Email Overdue Notification
Staff -> Books : Update Inventory

# Positions
Member: 80, 250
Checkout: 280, 150
Return: 280, 350
Books: 480, 150
Loans: 480, 350
Alert: 680, 350
Staff: 680, 150
`
};
