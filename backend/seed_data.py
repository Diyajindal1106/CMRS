import os
import django
import sys
from decimal import Decimal
from datetime import date, timedelta
from django.utils import timezone

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cmrs.settings')
django.setup()

from core.models import User, Branch, AuditLog
from loans.models import Customer, Loan, RepaymentSchedule
from collections_app.models import Collection, CashSubmission, Discrepancy
from banking.models import BankDeposit
from core.services import log_audit_event

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def run_seed():
    print("[*] Seeding CMRS Database with realistic financial and operational data...")

    # Clear existing data for clean seed
    AuditLog.objects.all().delete()
    Discrepancy.objects.all().delete()
    Collection.objects.all().delete()
    CashSubmission.objects.all().delete()
    BankDeposit.objects.all().delete()
    RepaymentSchedule.objects.all().delete()
    Loan.objects.all().delete()
    Customer.objects.all().delete()
    User.objects.all().delete()
    Branch.objects.all().delete()

    print("Cleared existing tables.")

    # 1. Create Branches
    mumbai_branch = Branch.objects.create(
        code="BR-MUM-01",
        name="Mumbai Central Branch",
        city="Mumbai",
        state="Maharashtra",
        address="Ground Floor, FinTech Plaza, Senapati Bapat Marg, Lower Parel",
        contact_number="+91 22 4001 8800",
        vault_cash_balance=Decimal("125000.00")
    )

    delhi_branch = Branch.objects.create(
        code="BR-DEL-02",
        name="Delhi North Branch",
        city="New Delhi",
        state="Delhi",
        address="SCO 42-44, Netaji Subhash Place, Pitampura",
        contact_number="+91 11 2700 9900",
        vault_cash_balance=Decimal("78000.00")
    )

    blr_branch = Branch.objects.create(
        code="BR-BLR-03",
        name="Bengaluru South Branch",
        city="Bengaluru",
        state="Karnataka",
        address="102, 100 Feet Road, Indiranagar",
        contact_number="+91 80 4112 3344",
        vault_cash_balance=Decimal("45000.00")
    )

    print("✓ Created 3 Branches.")

    # 2. Create Users across Roles
    # Super Admin
    admin_user = User.objects.create_superuser(
        username="admin",
        email="admin@cmrs.fintech",
        password="Password@123",
        first_name="Aditya",
        last_name="Mehta",
        role=User.Role.ADMIN,
        employee_id="EMP-HQ-001",
        phone_number="+91 98200 11000"
    )

    # Branch Managers
    bm_mumbai = User.objects.create_user(
        username="bm_mumbai",
        email="bm.mumbai@cmrs.fintech",
        password="Password@123",
        first_name="Vikram",
        last_name="Seth",
        role=User.Role.BRANCH_MANAGER,
        branch=mumbai_branch,
        employee_id="EMP-BM-010",
        phone_number="+91 98200 22111"
    )

    bm_delhi = User.objects.create_user(
        username="bm_delhi",
        email="bm.delhi@cmrs.fintech",
        password="Password@123",
        first_name="Sunita",
        last_name="Verma",
        role=User.Role.BRANCH_MANAGER,
        branch=delhi_branch,
        employee_id="EMP-BM-020",
        phone_number="+91 98110 33222"
    )

    # Collection Agents
    agent_rajesh = User.objects.create_user(
        username="agent_rajesh",
        email="agent.rajesh@cmrs.fintech",
        password="Password@123",
        first_name="Rajesh",
        last_name="Kumar",
        role=User.Role.COLLECTION_AGENT,
        branch=mumbai_branch,
        employee_id="EMP-AG-101",
        phone_number="+91 98200 44333",
        cash_in_hand=Decimal("18500.00")
    )

    agent_amit = User.objects.create_user(
        username="agent_amit",
        email="agent.amit@cmrs.fintech",
        password="Password@123",
        first_name="Amit",
        last_name="Patel",
        role=User.Role.COLLECTION_AGENT,
        branch=mumbai_branch,
        employee_id="EMP-AG-102",
        phone_number="+91 98200 55444",
        cash_in_hand=Decimal("12000.00")
    )

    agent_priya = User.objects.create_user(
        username="agent_priya",
        email="agent.priya@cmrs.fintech",
        password="Password@123",
        first_name="Priya",
        last_name="Sharma",
        role=User.Role.COLLECTION_AGENT,
        branch=delhi_branch,
        employee_id="EMP-AG-201",
        phone_number="+91 98110 66555",
        cash_in_hand=Decimal("15000.00")
    )

    print("✓ Created Users for all roles (Admin, BM Mumbai, BM Delhi, Agents).")

    # 3. Create Customers
    customers_data = [
        {"code": "CUST-1001", "first": "Ramesh", "last": "Yadav", "phone": "+91 98201 00001", "email": "ramesh.y@gmail.com", "addr": "Dharavi Sector 3, Mumbai", "nid": "ABCDE1234F", "agent": agent_rajesh, "branch": mumbai_branch},
        {"code": "CUST-1002", "first": "Suresh", "last": "Gupta", "phone": "+91 98201 00002", "email": "suresh.g@gmail.com", "addr": "Kurla West, Mumbai", "nid": "BCDEF2345G", "agent": agent_rajesh, "branch": mumbai_branch},
        {"code": "CUST-1003", "first": "Kavita", "last": "Shinde", "phone": "+91 98201 00003", "email": "kavita.s@gmail.com", "addr": "Dadar East, Mumbai", "nid": "CDEFG3456H", "agent": agent_rajesh, "branch": mumbai_branch},
        {"code": "CUST-1004", "first": "Anil", "last": "Sawant", "phone": "+91 98201 00004", "email": "anil.s@gmail.com", "addr": "Bandra East, Mumbai", "nid": "DEFGH4567J", "agent": agent_amit, "branch": mumbai_branch},
        {"code": "CUST-1005", "first": "Deepak", "last": "Chauhan", "phone": "+91 98111 00005", "email": "deepak.c@gmail.com", "addr": "Rohini Sector 7, New Delhi", "nid": "EFGHI5678K", "agent": agent_priya, "branch": delhi_branch},
        {"code": "CUST-1006", "first": "Pooja", "last": "Malhotra", "phone": "+91 98111 00006", "email": "pooja.m@gmail.com", "addr": "Karol Bagh, New Delhi", "nid": "FGHIJ6789L", "agent": agent_priya, "branch": delhi_branch},
        {"code": "CUST-1007", "first": "Mohit", "last": "Arora", "phone": "+91 98111 00007", "email": "mohit.a@gmail.com", "addr": "Shalimar Bagh, New Delhi", "nid": "GHIJK7890M", "agent": agent_priya, "branch": delhi_branch},
    ]

    customers = {}
    for c in customers_data:
        cust = Customer.objects.create(
            customer_code=c["code"],
            first_name=c["first"],
            last_name=c["last"],
            phone=c["phone"],
            email=c["email"],
            address=c["addr"],
            national_id=c["nid"],
            assigned_agent=c["agent"],
            branch=c["branch"]
        )
        customers[c["code"]] = cust

    print(f"✓ Created {len(customers)} Customers.")

    # 4. Create Loans & Repayment Schedules
    today = timezone.now().date()
    loans_info = [
        {"num": "LN-2026-101", "cust": "CUST-1001", "principal": Decimal("60000.00"), "rate": Decimal("14.00"), "tenure": 12, "payable": Decimal("68400.00"), "collected": Decimal("22800.00"), "disbursed": today - timedelta(days=90)},
        {"num": "LN-2026-102", "cust": "CUST-1002", "principal": Decimal("40000.00"), "rate": Decimal("15.00"), "tenure": 8, "payable": Decimal("45000.00"), "collected": Decimal("11250.00"), "disbursed": today - timedelta(days=60)},
        {"num": "LN-2026-103", "cust": "CUST-1003", "principal": Decimal("100000.00"), "rate": Decimal("12.00"), "tenure": 10, "payable": Decimal("112000.00"), "collected": Decimal("22400.00"), "disbursed": today - timedelta(days=60)},
        {"num": "LN-2026-104", "cust": "CUST-1004", "principal": Decimal("50000.00"), "rate": Decimal("14.00"), "tenure": 10, "payable": Decimal("57000.00"), "collected": Decimal("11400.00"), "disbursed": today - timedelta(days=60)},
        {"num": "LN-2026-105", "cust": "CUST-1005", "principal": Decimal("80000.00"), "rate": Decimal("13.50"), "tenure": 12, "payable": Decimal("90800.00"), "collected": Decimal("22700.00"), "disbursed": today - timedelta(days=90)},
        {"num": "LN-2026-106", "cust": "CUST-1006", "principal": Decimal("35000.00"), "rate": Decimal("15.00"), "tenure": 7, "payable": Decimal("39375.00"), "collected": Decimal("11250.00"), "disbursed": today - timedelta(days=60)},
        {"num": "LN-2026-107", "cust": "CUST-1007", "principal": Decimal("120000.00"), "rate": Decimal("12.50"), "tenure": 12, "payable": Decimal("135000.00"), "collected": Decimal("0.00"), "disbursed": today - timedelta(days=15)},
    ]

    loans = {}
    for l in loans_info:
        cust = customers[l["cust"]]
        outstanding = l["payable"] - l["collected"]
        loan = Loan.objects.create(
            loan_account_number=l["num"],
            customer=cust,
            branch=cust.branch,
            principal_amount=l["principal"],
            interest_rate=l["rate"],
            tenure_months=l["tenure"],
            total_amount_payable=l["payable"],
            total_amount_collected=l["collected"],
            outstanding_balance=outstanding,
            status=Loan.Status.ACTIVE,
            disbursed_at=l["disbursed"]
        )
        loans[l["num"]] = loan

        # Generate installment schedules
        installment_emi = (l["payable"] / Decimal(l["tenure"])).quantize(Decimal("0.01"))
        paid_remaining = l["collected"]

        for inst_num in range(1, l["tenure"] + 1):
            due_d = l["disbursed"] + timedelta(days=30 * inst_num)
            paid_for_inst = Decimal("0.00")
            inst_status = RepaymentSchedule.Status.PENDING

            if paid_remaining >= installment_emi:
                paid_for_inst = installment_emi
                paid_remaining -= installment_emi
                inst_status = RepaymentSchedule.Status.PAID
            elif paid_remaining > Decimal("0.00"):
                paid_for_inst = paid_remaining
                paid_remaining = Decimal("0.00")
                inst_status = RepaymentSchedule.Status.PARTIAL
            else:
                if due_d < today:
                    inst_status = RepaymentSchedule.Status.OVERDUE
                else:
                    inst_status = RepaymentSchedule.Status.PENDING

            RepaymentSchedule.objects.create(
                loan=loan,
                installment_number=inst_num,
                due_date=due_d,
                due_amount=installment_emi,
                paid_amount=paid_for_inst,
                status=inst_status
            )

    print(f"✓ Created {len(loans)} Loans and corresponding EMI Repayment Schedules.")

    # 5. Create Past Historical Collections and Submissions
    # A) Existing Settled Batch (Full Lifecycle Demonstrated)
    sub_settled = CashSubmission.objects.create(
        submission_number="SUB-20261001-001",
        agent=agent_rajesh,
        branch=mumbai_branch,
        total_expected_amount=Decimal("45000.00"),
        total_actual_amount=Decimal("45000.00"),
        discrepancy_amount=Decimal("0.00"),
        status=CashSubmission.Status.BANK_DEPOSITED,
        reconciled_by=bm_mumbai,
        reconciled_at=timezone.now() - timedelta(days=7),
        agent_notes="Regular weekly collection batch",
        branch_notes="Physical cash matched exactly."
    )

    dep_settled = BankDeposit.objects.create(
        deposit_slip_number="DEP-20261002-001",
        branch=mumbai_branch,
        bank_name="HDFC Bank",
        bank_account_number="50200049281734",
        deposit_date=today - timedelta(days=6),
        amount=Decimal("45000.00"),
        bank_reference_number="UTR-HDFC-20261002-884920",
        status=BankDeposit.Status.SETTLED,
        created_by=bm_mumbai,
        settled_at=timezone.now() - timedelta(days=5),
        settled_amount=Decimal("45000.00"),
        settlement_variance=Decimal("0.00"),
        settlement_notes="Verified against HDFC Bank e-statement. Credited successfully.",
        settled_by=admin_user,
        notes="Bank deposit slip stamped at Lower Parel Branch"
    )
    sub_settled.bank_deposit = dep_settled
    sub_settled.save()

    # Receipts under this settled batch
    Collection.objects.create(
        receipt_number="REC-20261001-0001",
        loan=loans["LN-2026-101"],
        customer=loans["LN-2026-101"].customer,
        agent=agent_rajesh,
        branch=mumbai_branch,
        amount=Decimal("22800.00"),
        payment_mode=Collection.PaymentMode.CASH,
        status=Collection.Status.SETTLED,
        cash_submission=sub_settled,
        idempotency_key="IDEMP-HIST-001",
        notes="Q3 EMI installment payment"
    )
    Collection.objects.create(
        receipt_number="REC-20261001-0002",
        loan=loans["LN-2026-103"],
        customer=loans["LN-2026-103"].customer,
        agent=agent_rajesh,
        branch=mumbai_branch,
        amount=Decimal("22200.00"),
        payment_mode=Collection.PaymentMode.CASH,
        status=Collection.Status.SETTLED,
        cash_submission=sub_settled,
        idempotency_key="IDEMP-HIST-002",
        notes="Partial principal and interest"
    )

    # B) Bank Deposit with SETTLEMENT MISMATCH (Demonstrating business case)
    dep_mismatch = BankDeposit.objects.create(
        deposit_slip_number="DEP-20261005-002",
        branch=delhi_branch,
        bank_name="State Bank of India",
        bank_account_number="309811245678",
        deposit_date=today - timedelta(days=3),
        amount=Decimal("50000.00"),
        bank_reference_number="SBI-CHALLAN-20261005-7712",
        status=BankDeposit.Status.SETTLEMENT_MISMATCH,
        created_by=bm_delhi,
        settled_at=timezone.now() - timedelta(days=2),
        settled_amount=Decimal("49850.00"),
        settlement_variance=Decimal("-150.00"),
        settlement_notes="Bank credited ₹49,850. ₹150 discrepancy flagged due to teller cash handling deduction.",
        settled_by=admin_user,
        notes="SBI Cash Deposit Counter 4"
    )

    # C) Submission with SHORTAGE DISCREPANCY (Demonstrating example from prompt: Expected ₹50,000, Actual ₹48,500, Difference -₹1,500)
    sub_discrepancy = CashSubmission.objects.create(
        submission_number="SUB-20261006-002",
        agent=agent_amit,
        branch=mumbai_branch,
        total_expected_amount=Decimal("50000.00"),
        total_actual_amount=Decimal("48500.00"),
        discrepancy_amount=Decimal("-1500.00"),
        status=CashSubmission.Status.RECONCILED,
        reconciled_by=bm_mumbai,
        reconciled_at=timezone.now() - timedelta(days=2),
        agent_notes="Agent hand-delivered cash packet to cashier",
        branch_notes="Physical note count showed ₹48,500. Shortage of ₹1,500 noted for recovery."
    )

    Discrepancy.objects.create(
        submission=sub_discrepancy,
        agent=agent_amit,
        branch=mumbai_branch,
        expected_amount=Decimal("50000.00"),
        actual_amount=Decimal("48500.00"),
        difference=Decimal("-1500.00"),
        discrepancy_type=Discrepancy.DiscrepancyType.SHORTAGE,
        resolution_status=Discrepancy.ResolutionStatus.INVESTIGATING,
        resolution_notes="Discrepancy flagged by BM Vikram. Agent Amit will submit remaining ₹1,500 tomorrow."
    )

    # D) PENDING Cash Submission (Awaiting BM verification in UI!)
    sub_pending = CashSubmission.objects.create(
        submission_number="SUB-20261008-003",
        agent=agent_rajesh,
        branch=mumbai_branch,
        total_expected_amount=Decimal("35000.00"),
        status=CashSubmission.Status.PENDING_APPROVAL,
        agent_notes="Morning collection run from Dharavi and Kurla borrowers"
    )

    # Collections linked to pending submission
    Collection.objects.create(
        receipt_number="REC-20261008-5511",
        loan=loans["LN-2026-101"],
        customer=loans["LN-2026-101"].customer,
        agent=agent_rajesh,
        branch=mumbai_branch,
        amount=Decimal("20000.00"),
        payment_mode=Collection.PaymentMode.CASH,
        status=Collection.Status.SUBMITTED,
        cash_submission=sub_pending,
        idempotency_key="IDEMP-PEND-001",
        notes="Installment payment received in cash"
    )
    Collection.objects.create(
        receipt_number="REC-20261008-5512",
        loan=loans["LN-2026-102"],
        customer=loans["LN-2026-102"].customer,
        agent=agent_rajesh,
        branch=mumbai_branch,
        amount=Decimal("15000.00"),
        payment_mode=Collection.PaymentMode.CASH,
        status=Collection.Status.SUBMITTED,
        cash_submission=sub_pending,
        idempotency_key="IDEMP-PEND-002",
        notes="Advance partial payment"
    )

    # E) Live UN-SUBMITTED Cash in Hand with Agent Rajesh (Ready for Agent to submit in UI!)
    Collection.objects.create(
        receipt_number="REC-20261009-9001",
        loan=loans["LN-2026-102"],
        customer=loans["LN-2026-102"].customer,
        agent=agent_rajesh,
        branch=mumbai_branch,
        amount=Decimal("8500.00"),
        payment_mode=Collection.PaymentMode.CASH,
        status=Collection.Status.COLLECTED,
        idempotency_key="IDEMP-LIVE-001",
        notes="Doorstep cash collection"
    )
    Collection.objects.create(
        receipt_number="REC-20261009-9002",
        loan=loans["LN-2026-103"],
        customer=loans["LN-2026-103"].customer,
        agent=agent_rajesh,
        branch=mumbai_branch,
        amount=Decimal("10000.00"),
        payment_mode=Collection.PaymentMode.CASH,
        status=Collection.Status.COLLECTED,
        idempotency_key="IDEMP-LIVE-002",
        notes="Cash collection with customer signature"
    )

    # F) UPI Digital Repayment (Sandbox Gateway demo)
    Collection.objects.create(
        receipt_number="REC-20261009-UPI-01",
        loan=loans["LN-2026-106"],
        customer=loans["LN-2026-106"].customer,
        agent=agent_priya,
        branch=delhi_branch,
        amount=Decimal("5625.00"),
        payment_mode=Collection.PaymentMode.UPI_SANDBOX,
        payment_reference="UPI-SANDBOX-REF-998822",
        status=Collection.Status.SETTLED,
        idempotency_key="IDEMP-UPI-001",
        notes="Customer paid via simulated UPI QR code scanner in field"
    )

    # G) Bank Deposit ready to be settled by BM / Finance
    BankDeposit.objects.create(
        deposit_slip_number="DEP-20261009-003",
        branch=mumbai_branch,
        bank_name="ICICI Bank",
        bank_account_number="000405012398",
        deposit_date=today,
        amount=Decimal("60000.00"),
        bank_reference_number="ICICI-UTR-20261009-99410",
        status=BankDeposit.Status.DEPOSITED,
        created_by=bm_mumbai,
        notes="Deposited cash at ICICI Fort Branch. Challan attached."
    )

    # Seed Audit Logs
    log_audit_event(admin_user, "SYSTEM_INITIALIZED", "System", "0", {"message": "CMRS Database seeded successfully."})
    log_audit_event(bm_mumbai, "BANK_DEPOSIT_CREATED", "BankDeposit", "DEP-20261009-003", {"amount": "60000.00"})
    log_audit_event(agent_rajesh, "COLLECTION_RECORDED", "Collection", "REC-20261009-9001", {"amount": "8500.00"})

    print("✓ Created complete lifecycle collections, submissions, discrepancies, deposits, settlements & audit trail.")
    print("✨ CMRS database seeding completed successfully!")

if __name__ == '__main__':
    run_seed()
