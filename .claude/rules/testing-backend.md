# Backend Testing Rules and Guidelines

## Core Testing Requirements

### 🔴 MANDATORY: Test Implementation and Execution

**All agents MUST follow these testing rules when working on backend code:**

1. **For NEW Features/Endpoints:**
   - ALWAYS create corresponding test files for every new model, view, serializer, and service
   - Test file naming convention: `test_*.py` (e.g., `test_models.py`, `test_views.py`, `test_services.py`)
   - Tests must be created in the same PR/commit as the feature
   - Run tests immediately after implementation to verify they pass

2. **For EXISTING Code:**
   - ALWAYS run existing tests after making any modifications
   - Update tests if the behavior, business logic, or API contracts change
   - Add new test cases for new functionality or edge cases
   - Fix any broken tests before marking the task as complete

3. **Test Execution Requirements:**
   - Run `python manage.py test` after EVERY backend change
   - Ensure all tests pass before committing code
   - Run tests for the specific app when working on isolated changes
   - Include test results in your completion summary
   - Check test coverage and ensure it meets minimum requirements

## Testing Framework and Tools

### Technology Stack
- **Testing Framework**: Django's built-in TestCase (based on unittest)
- **API Testing**: Django REST Framework's APITestCase
- **Database**: Test database (automatically created/destroyed)
- **Mocking**: unittest.mock for external services
- **Factory Library**: factory_boy for test data generation
- **Coverage Tool**: coverage.py

### Setup Commands
```bash
# Install testing dependencies
pip install factory-boy coverage pytest-django freezegun responses

# Run all tests
python manage.py test

# Run tests for specific app
python manage.py test apps.users
python manage.py test apps.investments

# Run specific test class
python manage.py test apps.users.tests.test_models.UserModelTest

# Run specific test method
python manage.py test apps.users.tests.test_models.UserModelTest.test_user_creation

# Run tests with coverage
coverage run --source='.' manage.py test
coverage report
coverage html  # Generate HTML report

# Run tests in parallel (faster)
python manage.py test --parallel

# Run tests with verbose output
python manage.py test --verbosity=2
```

## What to Test

### Backend Testing Checklist

#### 1. **Model Tests** (`test_models.py`)
- [ ] Model creation with valid data
- [ ] Model validation (required fields, constraints)
- [ ] Model methods and properties
- [ ] Model string representation (`__str__`)
- [ ] Model relationships (ForeignKey, ManyToMany)
- [ ] Custom model managers
- [ ] Model signals (if any)
- [ ] Database constraints and indexes

#### 2. **API View Tests** (`test_views.py`)
- [ ] Successful responses (200, 201)
- [ ] Authentication requirements (401, 403)
- [ ] Input validation (400)
- [ ] Resource not found (404)
- [ ] Method not allowed (405)
- [ ] Pagination works correctly
- [ ] Filtering and searching
- [ ] Sorting functionality
- [ ] Permission checks
- [ ] Rate limiting (if implemented)

#### 3. **Serializer Tests** (`test_serializers.py`)
- [ ] Valid data serialization
- [ ] Invalid data rejection
- [ ] Field validation rules
- [ ] Nested serialization
- [ ] Custom field methods
- [ ] Read-only fields enforcement
- [ ] Required vs optional fields

#### 4. **Service Layer Tests** (`test_services.py`)
- [ ] Business logic correctness
- [ ] Transaction handling
- [ ] Error handling and exceptions
- [ ] External API integration (mocked)
- [ ] Blockchain interactions (mocked)
- [ ] Email sending (mocked)
- [ ] Background task queuing

#### 5. **Authentication Tests** (`test_authentication.py`)
- [ ] Privy token verification
- [ ] JWT token validation
- [ ] User creation on first login
- [ ] Permission classes
- [ ] Authentication middleware

#### 6. **Integration Tests** (`test_integration.py`)
- [ ] End-to-end workflows
- [ ] Multi-step processes (investment flow)
- [ ] Database transactions
- [ ] Cache interactions (if any)
- [ ] File upload/download

## Test File Structure Templates

### Model Test Template
```python
# apps/users/tests/test_models.py
from django.test import TestCase
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from apps.users.models import User, KYCRecord
from decimal import Decimal
import uuid


class UserModelTest(TestCase):
    def setUp(self):
        """Set up test fixtures"""
        self.user_data = {
            'privy_user_id': 'privy_test_123',
            'email': 'test@example.com',
            'wallet_address': '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7',
            'first_name': 'John',
            'last_name': 'Doe'
        }

    def tearDown(self):
        """Clean up after tests"""
        User.objects.all().delete()

    def test_user_creation(self):
        """Test creating a user with valid data"""
        user = User.objects.create(**self.user_data)

        self.assertIsInstance(user.id, uuid.UUID)
        self.assertEqual(user.email, 'test@example.com')
        self.assertEqual(user.wallet_address, '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7')
        self.assertEqual(user.accreditation_status, 'pending')
        self.assertIsNotNone(user.created_at)

    def test_unique_constraints(self):
        """Test that unique fields are enforced"""
        User.objects.create(**self.user_data)

        # Try to create another user with same privy_user_id
        with self.assertRaises(IntegrityError):
            User.objects.create(**self.user_data)

    def test_email_validation(self):
        """Test email field validation"""
        self.user_data['email'] = 'invalid-email'
        user = User(**self.user_data)

        with self.assertRaises(ValidationError):
            user.full_clean()

    def test_wallet_address_format(self):
        """Test wallet address validation"""
        self.user_data['wallet_address'] = 'invalid_address'
        user = User(**self.user_data)

        with self.assertRaises(ValidationError) as context:
            user.full_clean()

        self.assertIn('wallet_address', context.exception.error_dict)

    def test_user_str_representation(self):
        """Test the string representation of User"""
        user = User.objects.create(**self.user_data)
        expected = f"{user.first_name} {user.last_name} ({user.email})"
        self.assertEqual(str(user), expected)

    def test_kyc_relationship(self):
        """Test User-KYCRecord relationship"""
        user = User.objects.create(**self.user_data)
        kyc = KYCRecord.objects.create(
            user=user,
            status='pending',
            verification_data={}
        )

        self.assertEqual(user.kyc_records.count(), 1)
        self.assertEqual(user.kyc_records.first(), kyc)
```

### API View Test Template
```python
# apps/investments/tests/test_views.py
from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from unittest.mock import patch, Mock
from apps.users.models import User
from apps.startups.models import Startup, InvestmentRound
from apps.investments.models import Investment
from decimal import Decimal
import json


class InvestmentAPITest(APITestCase):
    def setUp(self):
        """Set up test data"""
        # Create test user
        self.user = User.objects.create(
            privy_user_id='privy_123',
            email='investor@example.com',
            wallet_address='0x123...',
            accreditation_status='verified'
        )

        # Create test startup and round
        self.startup = Startup.objects.create(
            name='Test Startup',
            description='A test startup',
            valuation=Decimal('1000000.00')
        )

        self.round = InvestmentRound.objects.create(
            startup=self.startup,
            name='Seed Round',
            round_type='seed',
            target_amount=Decimal('500000.00'),
            min_investment=Decimal('1000.00'),
            max_investment=Decimal('100000.00'),
            status='active'
        )

        # Set up authentication
        self.client.credentials(
            HTTP_AUTHORIZATION='Bearer valid_token_123'
        )

    @patch('apps.authentication.middleware.verify_privy_token')
    def test_create_investment_success(self, mock_verify):
        """Test successful investment creation"""
        mock_verify.return_value = {
            'user_id': 'privy_123',
            'wallet_address': '0x123...'
        }

        url = reverse('investment-list')
        data = {
            'round_id': str(self.round.id),
            'amount': '5000.00'
        }

        with patch('apps.blockchain.services.PrivyWalletService') as mock_wallet:
            mock_wallet.return_value.send_investment_transaction.return_value = {
                'tx_hash': '0xabc123...',
                'status': 'pending'
            }

            response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('id', response.data)
        self.assertEqual(response.data['amount'], '5000.00')
        self.assertEqual(response.data['status'], 'pending')

        # Verify investment was created in database
        investment = Investment.objects.get(id=response.data['id'])
        self.assertEqual(investment.user, self.user)
        self.assertEqual(investment.amount_usd, Decimal('5000.00'))

    @patch('apps.authentication.middleware.verify_privy_token')
    def test_create_investment_below_minimum(self, mock_verify):
        """Test investment below minimum amount"""
        mock_verify.return_value = {
            'user_id': 'privy_123',
            'wallet_address': '0x123...'
        }

        url = reverse('investment-list')
        data = {
            'round_id': str(self.round.id),
            'amount': '500.00'  # Below minimum of 1000
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertIn('minimum', response.data['error'].lower())

    @patch('apps.authentication.middleware.verify_privy_token')
    def test_create_investment_above_maximum(self, mock_verify):
        """Test investment above maximum amount"""
        mock_verify.return_value = {
            'user_id': 'privy_123',
            'wallet_address': '0x123...'
        }

        url = reverse('investment-list')
        data = {
            'round_id': str(self.round.id),
            'amount': '150000.00'  # Above maximum of 100000
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertIn('maximum', response.data['error'].lower())

    def test_create_investment_unauthenticated(self):
        """Test investment creation without authentication"""
        self.client.credentials()  # Remove authentication

        url = reverse('investment-list')
        data = {
            'round_id': str(self.round.id),
            'amount': '5000.00'
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch('apps.authentication.middleware.verify_privy_token')
    def test_create_investment_unaccredited_user(self, mock_verify):
        """Test investment by unaccredited user"""
        mock_verify.return_value = {
            'user_id': 'privy_123',
            'wallet_address': '0x123...'
        }

        # Change user to unaccredited
        self.user.accreditation_status = 'pending'
        self.user.save()

        url = reverse('investment-list')
        data = {
            'round_id': str(self.round.id),
            'amount': '5000.00'
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('error', response.data)
        self.assertIn('accreditation', response.data['error'].lower())

    @patch('apps.authentication.middleware.verify_privy_token')
    def test_list_user_investments(self, mock_verify):
        """Test listing user's investments"""
        mock_verify.return_value = {
            'user_id': 'privy_123',
            'wallet_address': '0x123...'
        }

        # Create test investments
        Investment.objects.create(
            user=self.user,
            round=self.round,
            amount_usd=Decimal('5000.00'),
            status='completed'
        )
        Investment.objects.create(
            user=self.user,
            round=self.round,
            amount_usd=Decimal('10000.00'),
            status='pending'
        )

        url = reverse('investment-list')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)
        self.assertEqual(response.data['count'], 2)

    @patch('apps.authentication.middleware.verify_privy_token')
    def test_get_investment_detail(self, mock_verify):
        """Test getting specific investment details"""
        mock_verify.return_value = {
            'user_id': 'privy_123',
            'wallet_address': '0x123...'
        }

        investment = Investment.objects.create(
            user=self.user,
            round=self.round,
            amount_usd=Decimal('5000.00'),
            status='completed'
        )

        url = reverse('investment-detail', kwargs={'pk': investment.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], str(investment.id))
        self.assertEqual(response.data['amount_usd'], '5000.00')
```

### Service Test Template
```python
# apps/blockchain/tests/test_services.py
from django.test import TestCase
from unittest.mock import patch, Mock, MagicMock
from apps.blockchain.services import (
    PrivyWalletService,
    TransactionMonitorService,
    SmartContractService
)
from apps.users.models import User
from apps.investments.models import Investment
from apps.blockchain.models import BlockchainTransaction
from decimal import Decimal


class PrivyWalletServiceTest(TestCase):
    def setUp(self):
        """Set up test fixtures"""
        self.user = User.objects.create(
            privy_user_id='privy_123',
            email='test@example.com',
            wallet_address='0x123...'
        )
        self.service = PrivyWalletService()

    @patch('apps.blockchain.services.privy_client')
    def test_get_user_wallet(self, mock_privy):
        """Test retrieving user's embedded wallet"""
        mock_wallet = Mock()
        mock_wallet.address = '0x123...'
        mock_privy.get_user_wallet.return_value = mock_wallet

        wallet = self.service.get_user_wallet(self.user.privy_user_id)

        self.assertEqual(wallet.address, '0x123...')
        mock_privy.get_user_wallet.assert_called_once_with(self.user.privy_user_id)

    @patch('apps.blockchain.services.privy_client')
    @patch('apps.blockchain.services.web3')
    def test_send_investment_transaction(self, mock_web3, mock_privy):
        """Test sending investment transaction"""
        # Mock Privy wallet
        mock_wallet = Mock()
        mock_wallet.address = '0x123...'
        mock_privy.get_user_wallet.return_value = mock_wallet

        # Mock transaction signing and sending
        mock_privy.sign_and_send_transaction.return_value = {
            'tx_hash': '0xabc123...',
            'status': 'pending'
        }

        # Mock contract interaction
        mock_contract = Mock()
        mock_web3.eth.contract.return_value = mock_contract
        mock_contract.functions.invest.return_value.build_transaction.return_value = {
            'to': '0xcontract...',
            'data': '0x...',
            'value': 0,
            'gas': 100000
        }

        result = self.service.send_investment_transaction(
            user_id=self.user.privy_user_id,
            amount=Decimal('1000.00'),
            round_address='0xround...'
        )

        self.assertEqual(result['tx_hash'], '0xabc123...')
        self.assertEqual(result['status'], 'pending')
        mock_privy.sign_and_send_transaction.assert_called_once()

    @patch('apps.blockchain.services.privy_client')
    def test_send_transaction_with_gas_sponsorship(self, mock_privy):
        """Test transaction with gas sponsorship"""
        mock_wallet = Mock()
        mock_privy.get_user_wallet.return_value = mock_wallet

        mock_privy.sign_and_send_transaction.return_value = {
            'tx_hash': '0xdef456...',
            'gas_sponsored': True
        }

        result = self.service.send_transaction_with_sponsorship(
            user_id=self.user.privy_user_id,
            transaction_data={'to': '0x...', 'data': '0x...'}
        )

        self.assertTrue(result['gas_sponsored'])
        self.assertEqual(result['tx_hash'], '0xdef456...')

    @patch('apps.blockchain.services.privy_client')
    def test_wallet_service_error_handling(self, mock_privy):
        """Test error handling in wallet service"""
        mock_privy.get_user_wallet.side_effect = Exception("Privy API error")

        with self.assertRaises(Exception) as context:
            self.service.get_user_wallet('invalid_user')

        self.assertIn("Privy API error", str(context.exception))


class TransactionMonitorServiceTest(TestCase):
    def setUp(self):
        """Set up test fixtures"""
        self.user = User.objects.create(
            privy_user_id='privy_123',
            email='test@example.com',
            wallet_address='0x123...'
        )
        self.investment = Investment.objects.create(
            user=self.user,
            amount_usd=Decimal('1000.00'),
            status='pending'
        )
        self.transaction = BlockchainTransaction.objects.create(
            investment=self.investment,
            transaction_hash='0xabc123...',
            status='pending'
        )
        self.service = TransactionMonitorService()

    @patch('apps.blockchain.services.web3')
    def test_check_transaction_status_confirmed(self, mock_web3):
        """Test checking confirmed transaction status"""
        mock_receipt = {
            'status': 1,  # Success
            'blockNumber': 12345,
            'gasUsed': 50000
        }
        mock_web3.eth.get_transaction_receipt.return_value = mock_receipt

        status = self.service.check_transaction_status(self.transaction.transaction_hash)

        self.assertEqual(status['status'], 'confirmed')
        self.assertEqual(status['block_number'], 12345)
        mock_web3.eth.get_transaction_receipt.assert_called_once_with('0xabc123...')

    @patch('apps.blockchain.services.web3')
    def test_check_transaction_status_pending(self, mock_web3):
        """Test checking pending transaction status"""
        mock_web3.eth.get_transaction_receipt.return_value = None

        status = self.service.check_transaction_status(self.transaction.transaction_hash)

        self.assertEqual(status['status'], 'pending')
        self.assertIsNone(status.get('block_number'))

    @patch('apps.blockchain.services.web3')
    def test_check_transaction_status_failed(self, mock_web3):
        """Test checking failed transaction status"""
        mock_receipt = {
            'status': 0,  # Failed
            'blockNumber': 12345,
            'gasUsed': 50000
        }
        mock_web3.eth.get_transaction_receipt.return_value = mock_receipt

        status = self.service.check_transaction_status(self.transaction.transaction_hash)

        self.assertEqual(status['status'], 'failed')

    @patch('apps.blockchain.services.web3')
    @patch('apps.blockchain.services.send_email')
    def test_monitor_and_update_transaction(self, mock_email, mock_web3):
        """Test monitoring and updating transaction status"""
        mock_receipt = {
            'status': 1,
            'blockNumber': 12345
        }
        mock_web3.eth.get_transaction_receipt.return_value = mock_receipt

        self.service.monitor_and_update_transaction(self.transaction.id)

        # Refresh from database
        self.transaction.refresh_from_db()
        self.investment.refresh_from_db()

        self.assertEqual(self.transaction.status, 'confirmed')
        self.assertEqual(self.transaction.block_number, 12345)
        self.assertEqual(self.investment.status, 'completed')

        # Check email was sent
        mock_email.assert_called_once()
```

### Serializer Test Template
```python
# apps/investments/tests/test_serializers.py
from django.test import TestCase
from apps.investments.serializers import (
    InvestmentSerializer,
    CreateInvestmentSerializer,
    PortfolioSerializer
)
from apps.users.models import User
from apps.startups.models import Startup, InvestmentRound
from apps.investments.models import Investment
from decimal import Decimal


class InvestmentSerializerTest(TestCase):
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create(
            privy_user_id='privy_123',
            email='test@example.com',
            wallet_address='0x123...'
        )
        self.startup = Startup.objects.create(
            name='Test Startup',
            valuation=Decimal('1000000.00')
        )
        self.round = InvestmentRound.objects.create(
            startup=self.startup,
            name='Seed',
            target_amount=Decimal('500000.00'),
            min_investment=Decimal('1000.00'),
            max_investment=Decimal('100000.00')
        )

    def test_investment_serialization(self):
        """Test serializing investment instance"""
        investment = Investment.objects.create(
            user=self.user,
            round=self.round,
            amount_usd=Decimal('5000.00'),
            token_amount=Decimal('500.00'),
            status='completed'
        )

        serializer = InvestmentSerializer(investment)
        data = serializer.data

        self.assertEqual(data['id'], str(investment.id))
        self.assertEqual(data['amount_usd'], '5000.00')
        self.assertEqual(data['token_amount'], '500.00')
        self.assertEqual(data['status'], 'completed')
        self.assertIn('round', data)
        self.assertIn('startup_name', data)

    def test_create_investment_validation_valid(self):
        """Test valid investment creation data"""
        data = {
            'round_id': str(self.round.id),
            'amount': '5000.00'
        }

        serializer = CreateInvestmentSerializer(data=data)
        self.assertTrue(serializer.is_valid())

        validated = serializer.validated_data
        self.assertEqual(validated['amount'], Decimal('5000.00'))
        self.assertEqual(validated['round_id'], self.round.id)

    def test_create_investment_validation_below_minimum(self):
        """Test investment amount below minimum"""
        data = {
            'round_id': str(self.round.id),
            'amount': '500.00'  # Below 1000 minimum
        }

        serializer = CreateInvestmentSerializer(data=data, context={'round': self.round})
        self.assertFalse(serializer.is_valid())
        self.assertIn('amount', serializer.errors)
        self.assertIn('minimum', str(serializer.errors['amount'][0]))

    def test_create_investment_validation_above_maximum(self):
        """Test investment amount above maximum"""
        data = {
            'round_id': str(self.round.id),
            'amount': '150000.00'  # Above 100000 maximum
        }

        serializer = CreateInvestmentSerializer(data=data, context={'round': self.round})
        self.assertFalse(serializer.is_valid())
        self.assertIn('amount', serializer.errors)
        self.assertIn('maximum', str(serializer.errors['amount'][0]))

    def test_create_investment_validation_invalid_round(self):
        """Test investment with invalid round ID"""
        data = {
            'round_id': 'invalid-uuid',
            'amount': '5000.00'
        }

        serializer = CreateInvestmentSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('round_id', serializer.errors)

    def test_portfolio_serialization(self):
        """Test portfolio summary serialization"""
        # Create investments
        Investment.objects.create(
            user=self.user,
            round=self.round,
            amount_usd=Decimal('5000.00'),
            status='completed'
        )
        Investment.objects.create(
            user=self.user,
            round=self.round,
            amount_usd=Decimal('10000.00'),
            status='completed'
        )

        portfolio_data = {
            'total_invested': Decimal('15000.00'),
            'total_value': Decimal('18000.00'),
            'total_investments': 2,
            'roi_percentage': Decimal('20.00')
        }

        serializer = PortfolioSerializer(portfolio_data)
        data = serializer.data

        self.assertEqual(data['total_invested'], '15000.00')
        self.assertEqual(data['total_value'], '18000.00')
        self.assertEqual(data['total_investments'], 2)
        self.assertEqual(data['roi_percentage'], '20.00')
```

### Authentication Test Template
```python
# apps/authentication/tests/test_authentication.py
from django.test import TestCase, RequestFactory
from rest_framework.test import APITestCase
from unittest.mock import patch, Mock
from apps.authentication.middleware import PrivyAuthenticationMiddleware
from apps.authentication.backends import PrivyAuthBackend
from apps.users.models import User
from django.contrib.auth.models import AnonymousUser
import jwt


class PrivyAuthenticationTest(TestCase):
    def setUp(self):
        """Set up test fixtures"""
        self.factory = RequestFactory()
        self.middleware = PrivyAuthenticationMiddleware(lambda r: r)
        self.backend = PrivyAuthBackend()

    @patch('apps.authentication.middleware.verify_privy_token')
    def test_valid_token_authentication(self, mock_verify):
        """Test authentication with valid Privy token"""
        mock_verify.return_value = {
            'user_id': 'privy_123',
            'email': 'test@example.com',
            'wallet_address': '0x123...'
        }

        request = self.factory.get('/')
        request.META['HTTP_AUTHORIZATION'] = 'Bearer valid_token_123'
        request.user = AnonymousUser()

        # Process request through middleware
        response = self.middleware(request)

        # Check user was authenticated
        self.assertTrue(hasattr(request, 'privy_user'))
        self.assertEqual(request.privy_user['user_id'], 'privy_123')
        mock_verify.assert_called_once_with('valid_token_123')

    @patch('apps.authentication.middleware.verify_privy_token')
    def test_invalid_token_authentication(self, mock_verify):
        """Test authentication with invalid token"""
        mock_verify.side_effect = jwt.InvalidTokenError("Invalid token")

        request = self.factory.get('/')
        request.META['HTTP_AUTHORIZATION'] = 'Bearer invalid_token'
        request.user = AnonymousUser()

        # Process request through middleware
        response = self.middleware(request)

        # Check user was not authenticated
        self.assertFalse(hasattr(request, 'privy_user'))

    def test_missing_token_authentication(self):
        """Test request without authentication token"""
        request = self.factory.get('/')
        request.user = AnonymousUser()

        # Process request through middleware
        response = self.middleware(request)

        # Check user was not authenticated
        self.assertFalse(hasattr(request, 'privy_user'))

    @patch('apps.authentication.backends.privy_client.verify_token')
    def test_backend_authenticate_creates_user(self, mock_verify):
        """Test that backend creates user on first login"""
        mock_verify.return_value = {
            'user_id': 'privy_new_user',
            'email': 'newuser@example.com',
            'wallet': {'address': '0x456...'}
        }

        user = self.backend.authenticate(
            request=None,
            privy_token='token_123'
        )

        self.assertIsNotNone(user)
        self.assertEqual(user.privy_user_id, 'privy_new_user')
        self.assertEqual(user.email, 'newuser@example.com')
        self.assertEqual(user.wallet_address, '0x456...')

        # Check user was saved to database
        db_user = User.objects.get(privy_user_id='privy_new_user')
        self.assertEqual(db_user.email, 'newuser@example.com')

    @patch('apps.authentication.backends.privy_client.verify_token')
    def test_backend_authenticate_existing_user(self, mock_verify):
        """Test that backend returns existing user"""
        # Create existing user
        existing_user = User.objects.create(
            privy_user_id='privy_existing',
            email='existing@example.com',
            wallet_address='0x789...'
        )

        mock_verify.return_value = {
            'user_id': 'privy_existing',
            'email': 'existing@example.com',
            'wallet': {'address': '0x789...'}
        }

        user = self.backend.authenticate(
            request=None,
            privy_token='token_456'
        )

        self.assertEqual(user.id, existing_user.id)
        self.assertEqual(User.objects.filter(privy_user_id='privy_existing').count(), 1)
```

## Testing Best Practices

### DO's ✅
- **DO** use Django's TestCase for database tests (automatic rollback)
- **DO** use APITestCase for API endpoint testing
- **DO** mock external services (Privy, AWS, Blockchain)
- **DO** test both success and failure scenarios
- **DO** test edge cases and boundary conditions
- **DO** use factories for complex test data creation
- **DO** test permissions and authentication
- **DO** test database transactions and rollbacks
- **DO** clean up test data in tearDown methods
- **DO** use descriptive test names that explain what is being tested

### DON'Ts ❌
- **DON'T** make real API calls to external services
- **DON'T** interact with real blockchain networks
- **DON'T** send real emails in tests
- **DON'T** use production database for testing
- **DON'T** test Django's built-in functionality
- **DON'T** write tests that depend on test execution order
- **DON'T** leave print statements in tests
- **DON'T** skip writing tests to save time
- **DON'T** use hardcoded dates without mocking (use freezegun)

## Coverage Requirements

### Minimum Coverage Targets
- **Statements**: 85%
- **Branches**: 80%
- **Functions**: 85%
- **Lines**: 85%

### Critical Components (95% Coverage Required)
- Authentication and authorization logic
- Investment transaction logic
- Blockchain interaction services
- Payment processing
- KYC verification logic
- Smart contract interaction code
- Financial calculations

## Test Data Factories

### Using Factory Boy
```python
# apps/users/tests/factories.py
import factory
from factory.django import DjangoModelFactory
from apps.users.models import User
from faker import Faker

fake = Faker()


class UserFactory(DjangoModelFactory):
    class Meta:
        model = User

    privy_user_id = factory.Sequence(lambda n: f"privy_user_{n}")
    email = factory.LazyAttribute(lambda obj: fake.email())
    wallet_address = factory.LazyAttribute(lambda obj: f"0x{fake.sha256()[:40]}")
    first_name = factory.Faker('first_name')
    last_name = factory.Faker('last_name')
    accreditation_status = 'verified'

    @factory.post_generation
    def kyc_records(self, create, extracted, **kwargs):
        if not create:
            return

        if extracted:
            for kyc in extracted:
                self.kyc_records.add(kyc)


class StartupFactory(DjangoModelFactory):
    class Meta:
        model = Startup

    name = factory.Faker('company')
    description = factory.Faker('text', max_nb_chars=200)
    industry = factory.Faker('random_element', elements=['fintech', 'healthtech', 'edtech', 'saas'])
    valuation = factory.Faker('pydecimal', left_digits=7, right_digits=2, positive=True)
    founded_date = factory.Faker('date_between', start_date='-5y', end_date='today')
    website = factory.Faker('url')
    status = 'active'


class InvestmentRoundFactory(DjangoModelFactory):
    class Meta:
        model = InvestmentRound

    startup = factory.SubFactory(StartupFactory)
    name = factory.Faker('random_element', elements=['Seed', 'Series A', 'Series B'])
    round_type = factory.Faker('random_element', elements=['seed', 'series_a', 'series_b'])
    target_amount = factory.Faker('pydecimal', left_digits=6, right_digits=2, positive=True)
    min_investment = Decimal('1000.00')
    max_investment = Decimal('100000.00')
    status = 'active'
```

## Test Execution Workflow

### For Agents/Developers

1. **Before Starting Work:**
   ```bash
   # Run existing tests to ensure clean state
   python manage.py test

   # Run with coverage to see current state
   coverage run --source='.' manage.py test
   coverage report
   ```

2. **After Creating New Features:**
   ```bash
   # Create test file for new app/feature
   touch apps/newapp/tests/test_models.py
   touch apps/newapp/tests/test_views.py
   touch apps/newapp/tests/test_services.py

   # Write tests
   # Run tests for the new app
   python manage.py test apps.newapp
   ```

3. **After Modifying Existing Code:**
   ```bash
   # Run specific app tests
   python manage.py test apps.investments

   # Run all tests to check for side effects
   python manage.py test

   # Check coverage
   coverage run --source='.' manage.py test
   coverage report
   ```

4. **Before Committing:**
   ```bash
   # Run all tests
   python manage.py test

   # Generate coverage report
   coverage run --source='.' manage.py test
   coverage html

   # Check coverage meets requirements
   coverage report --fail-under=85
   ```

## Integration Testing

### End-to-End Investment Flow Test
```python
# apps/investments/tests/test_integration.py
from django.test import TransactionTestCase
from unittest.mock import patch, Mock
from apps.users.models import User
from apps.investments.services import InvestmentService
from apps.blockchain.services import PrivyWalletService
from decimal import Decimal


class InvestmentFlowIntegrationTest(TransactionTestCase):
    def test_complete_investment_flow(self):
        """Test complete investment flow from API to blockchain"""
        with patch('apps.blockchain.services.privy_client') as mock_privy:
            with patch('apps.blockchain.services.web3') as mock_web3:
                # Setup mocks
                mock_privy.verify_token.return_value = {
                    'user_id': 'privy_123',
                    'email': 'investor@example.com'
                }
                mock_privy.sign_and_send_transaction.return_value = {
                    'tx_hash': '0xabc123...',
                    'status': 'pending'
                }
                mock_web3.eth.get_transaction_receipt.return_value = {
                    'status': 1,
                    'blockNumber': 12345
                }

                # Execute investment flow
                service = InvestmentService()
                result = service.create_investment(
                    user_id='privy_123',
                    round_id='round_uuid',
                    amount=Decimal('5000.00')
                )

                # Verify results
                self.assertEqual(result['status'], 'pending')
                self.assertEqual(result['tx_hash'], '0xabc123...')

                # Verify database state
                investment = Investment.objects.get(id=result['investment_id'])
                self.assertEqual(investment.amount_usd, Decimal('5000.00'))
                self.assertEqual(investment.status, 'pending')

                # Simulate transaction confirmation
                service.confirm_investment(result['investment_id'])

                investment.refresh_from_db()
                self.assertEqual(investment.status, 'completed')
```

## Background Task Testing

### Django-Q Task Test Template
```python
# apps/blockchain/tests/test_tasks.py
from django.test import TestCase
from unittest.mock import patch, Mock
from django_q.models import Task
from apps.blockchain.tasks import (
    monitor_transaction,
    send_investment_confirmation_email,
    update_cap_table
)


class BlockchainTasksTest(TestCase):
    @patch('apps.blockchain.tasks.TransactionMonitorService')
    def test_monitor_transaction_task(self, mock_service):
        """Test transaction monitoring background task"""
        mock_service.return_value.check_transaction_status.return_value = {
            'status': 'confirmed',
            'block_number': 12345
        }

        result = monitor_transaction('tx_123')

        self.assertEqual(result['status'], 'confirmed')
        mock_service.return_value.check_transaction_status.assert_called_once_with('tx_123')

    @patch('apps.blockchain.tasks.send_email')
    def test_send_confirmation_email_task(self, mock_email):
        """Test email sending task"""
        user_data = {
            'email': 'investor@example.com',
            'first_name': 'John'
        }
        investment_data = {
            'amount': '5000.00',
            'startup_name': 'Test Startup'
        }

        send_investment_confirmation_email(user_data, investment_data)

        mock_email.assert_called_once()
        call_args = mock_email.call_args[1]
        self.assertEqual(call_args['to'], 'investor@example.com')
        self.assertIn('5000.00', call_args['body'])
```

## Continuous Integration

### GitHub Actions Backend Test Workflow
```yaml
# .github/workflows/backend-tests.yml
name: Backend Tests

on:
  push:
    paths:
      - 'backend/**'
      - '.github/workflows/backend-tests.yml'
  pull_request:
    paths:
      - 'backend/**'

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: testuser
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: testdb
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements/test.txt

      - name: Run migrations
        env:
          DATABASE_URL: postgresql://testuser:testpass@localhost:5432/testdb
        run: |
          cd backend
          python manage.py migrate

      - name: Run tests with coverage
        env:
          DATABASE_URL: postgresql://testuser:testpass@localhost:5432/testdb
        run: |
          cd backend
          coverage run --source='.' manage.py test
          coverage report --fail-under=85

      - name: Generate coverage report
        run: |
          cd backend
          coverage xml

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage.xml
          flags: backend
          name: backend-coverage
```

## Mocking External Services

### Privy API Mocking
```python
# apps/authentication/tests/mocks.py
class MockPrivyClient:
    def verify_token(self, token):
        if token == 'valid_token':
            return {
                'user_id': 'privy_123',
                'email': 'test@example.com',
                'wallet': {'address': '0x123...'}
            }
        raise Exception("Invalid token")

    def get_user_wallet(self, user_id):
        return MockWallet(user_id)

    def sign_and_send_transaction(self, wallet, transaction):
        return {
            'tx_hash': '0xmocked...',
            'status': 'pending',
            'gas_sponsored': True
        }


class MockWallet:
    def __init__(self, user_id):
        self.address = f"0x{user_id[-10:]}..."
```

### AWS S3 Mocking
```python
# apps/documents/tests/mocks.py
from unittest.mock import MagicMock

def mock_s3_client():
    client = MagicMock()
    client.upload_fileobj.return_value = None
    client.generate_presigned_url.return_value = "https://mock-s3-url.com/file"
    client.delete_object.return_value = {'DeleteMarker': True}
    return client
```

## Emergency Procedures

### If Tests Are Failing:
1. **DON'T** comment out or skip failing tests
2. **DO** investigate why they're failing
3. **DO** check if external dependencies changed
4. **DO** fix the underlying issue
5. **DO** update tests if business logic changed
6. **DO** document any significant changes

### If Unable to Write Tests:
1. Mark the code with a TODO comment
2. Create a GitHub issue for missing tests
3. Document why tests couldn't be written
4. Add technical debt ticket to backlog
5. Schedule follow-up to add tests

---

## Summary for Agents

**REMEMBER: Every backend code change requires:**
1. ✅ Write/update tests IMMEDIATELY after implementation
2. ✅ Run tests to verify they pass (`python manage.py test`)
3. ✅ Mock all external services (Privy, AWS, Blockchain)
4. ✅ Fix any broken tests before proceeding
5. ✅ Check coverage meets minimum 85% requirement
6. ✅ Include test status in your completion report

**Testing is not optional - it's a critical part of maintaining the reliability and security of VelaFund's investment platform.**