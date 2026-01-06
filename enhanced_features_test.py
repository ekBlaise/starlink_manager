#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional

class EnhancedFeaturesAPITester:
    def __init__(self, base_url="https://satellite-hub.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test data storage
        self.test_account_id = None

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, expected_status: int = 200) -> tuple[bool, Dict]:
        """Make API request with proper headers"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                return False, {"error": f"Unsupported method: {method}"}

            success = response.status_code == expected_status
            try:
                response_data = response.json()
            except:
                response_data = {"status_code": response.status_code, "text": response.text}

            return success, response_data

        except Exception as e:
            return False, {"error": str(e)}

    def test_user_registration_with_phone(self):
        """Test user registration with phone number"""
        timestamp = int(datetime.now().timestamp())
        test_user = {
            "name": f"Enhanced Test User {timestamp}",
            "email": f"enhanced.test.{timestamp}@example.com",
            "password": "TestPass123!",
            "phone_number": "+1234567890"
        }
        
        success, response = self.make_request('POST', 'auth/register', test_user, 200)
        if success and 'token' in response and response['user'].get('phone_number') == "+1234567890":
            self.token = response['token']
            self.user_data = response['user']
            self.log_test("User Registration with Phone Number", True)
            return True
        else:
            self.log_test("User Registration with Phone Number", False, f"Response: {response}")
            return False

    def test_update_user_phone(self):
        """Test updating user phone number"""
        update_data = {"phone_number": "+9876543210"}
        
        success, response = self.make_request('PUT', 'auth/me', update_data, 200)
        if success and response.get('phone_number') == "+9876543210":
            self.user_data = response
            self.log_test("Update User Phone Number", True)
            return True
        else:
            self.log_test("Update User Phone Number", False, f"Response: {response}")
            return False

    def test_create_account_with_status(self):
        """Test creating account with status field"""
        account_data = {
            "account_name": "Enhanced Test Account",
            "location": "Test City, NY",
            "account_email": "enhanced.starlink@example.com",
            "kit_number": "UT-ENHANCED-123",
            "notes": "Test account with enhanced features",
            "billing_day": 25,  # Test billing day between 1-31
            "monthly_amount": 150.00,
            "status": "active"
        }
        
        success, response = self.make_request('POST', 'accounts', account_data, 200)
        if success and 'account_id' in response and response.get('status') == 'active':
            self.test_account_id = response['account_id']
            self.log_test("Create Account with Status Field", True)
            return True
        else:
            self.log_test("Create Account with Status Field", False, f"Response: {response}")
            return False

    def test_billing_day_validation(self):
        """Test billing day validation (1-31)"""
        # Test valid billing day
        update_data = {"billing_day": 31}
        success, response = self.make_request('PUT', f'accounts/{self.test_account_id}', update_data, 200)
        if not success or response.get('billing_day') != 31:
            self.log_test("Billing Day Validation (Valid)", False, f"Failed to set billing day 31: {response}")
            return False
        
        # Test invalid billing day (should fail)
        update_data = {"billing_day": 32}
        success, response = self.make_request('PUT', f'accounts/{self.test_account_id}', update_data, 400)
        if success:  # Should fail with 400
            self.log_test("Billing Day Validation (Invalid)", True)
            return True
        else:
            self.log_test("Billing Day Validation (Invalid)", False, f"Should have failed with 400: {response}")
            return False

    def test_account_status_filter(self):
        """Test filtering accounts by status"""
        # Test filtering by active status
        success, response = self.make_request('GET', 'accounts?account_status=active', None, 200)
        if success and isinstance(response, list):
            self.log_test("Filter Accounts by Status (Active)", True)
        else:
            self.log_test("Filter Accounts by Status (Active)", False, f"Response: {response}")
            return False
        
        # Test filtering by inactive status
        success, response = self.make_request('GET', 'accounts?account_status=inactive', None, 200)
        if success and isinstance(response, list):
            self.log_test("Filter Accounts by Status (Inactive)", True)
        else:
            self.log_test("Filter Accounts by Status (Inactive)", False, f"Response: {response}")
            return False
        
        # Test filtering by cancelled status
        success, response = self.make_request('GET', 'accounts?account_status=cancelled', None, 200)
        if success and isinstance(response, list):
            self.log_test("Filter Accounts by Status (Cancelled)", True)
            return True
        else:
            self.log_test("Filter Accounts by Status (Cancelled)", False, f"Response: {response}")
            return False

    def test_update_account_status(self):
        """Test updating account status"""
        # Update to inactive
        update_data = {"status": "inactive"}
        success, response = self.make_request('PUT', f'accounts/{self.test_account_id}', update_data, 200)
        if not success or response.get('status') != 'inactive':
            self.log_test("Update Account Status (Inactive)", False, f"Response: {response}")
            return False
        
        # Update to cancelled
        update_data = {"status": "cancelled"}
        success, response = self.make_request('PUT', f'accounts/{self.test_account_id}', update_data, 200)
        if not success or response.get('status') != 'cancelled':
            self.log_test("Update Account Status (Cancelled)", False, f"Response: {response}")
            return False
        
        # Update back to active
        update_data = {"status": "active"}
        success, response = self.make_request('PUT', f'accounts/{self.test_account_id}', update_data, 200)
        if success and response.get('status') == 'active':
            self.log_test("Update Account Status (All States)", True)
            return True
        else:
            self.log_test("Update Account Status (All States)", False, f"Response: {response}")
            return False

    def test_payment_record_with_paid_status(self):
        """Test creating payment record with paid/unpaid status"""
        # Create unpaid payment record
        payment_data = {
            "amount": 150.00,
            "payment_date": datetime.now(timezone.utc).isoformat(),
            "payment_method": "credit_card",
            "notes": "Test unpaid payment",
            "is_paid": False
        }
        
        success, response = self.make_request('POST', f'accounts/{self.test_account_id}/billing', payment_data, 200)
        if not success or response.get('is_paid') != False:
            self.log_test("Create Unpaid Payment Record", False, f"Response: {response}")
            return False
        
        billing_id = response['billing_id']
        
        # Toggle payment status to paid
        success, response = self.make_request('PUT', f'accounts/{self.test_account_id}/billing/{billing_id}?is_paid=true', None, 200)
        if not success:
            self.log_test("Toggle Payment Status", False, f"Response: {response}")
            return False
        
        # Verify the payment is now marked as paid
        success, response = self.make_request('GET', f'accounts/{self.test_account_id}/billing', None, 200)
        if success and isinstance(response, list) and len(response) > 0:
            payment = next((p for p in response if p['billing_id'] == billing_id), None)
            if payment and payment.get('is_paid') == True:
                self.log_test("Payment Status Toggle (Paid/Unpaid)", True)
                return True
        
        self.log_test("Payment Status Toggle (Paid/Unpaid)", False, "Could not verify payment status toggle")
        return False

    def test_notification_endpoints(self):
        """Test notification-related endpoints"""
        # Get notifications
        success, response = self.make_request('GET', 'notifications', None, 200)
        if not success or not isinstance(response, list):
            self.log_test("Get Notifications", False, f"Response: {response}")
            return False
        
        # Get notification count
        success, response = self.make_request('GET', 'notifications/count', None, 200)
        if not success or 'unread_count' not in response:
            self.log_test("Get Notification Count", False, f"Response: {response}")
            return False
        
        self.log_test("Notification Endpoints", True)
        return True

    def test_reminder_endpoints(self):
        """Test reminder-related endpoints"""
        # Test email endpoint
        success, response = self.make_request('POST', 'reminders/test-email', None, 200)
        if not success or 'success' not in response:
            self.log_test("Test Email Endpoint", False, f"Response: {response}")
            return False
        
        # Test SMS endpoint (should work if phone number is set)
        success, response = self.make_request('POST', 'reminders/test-sms', None, 200)
        if not success or 'success' not in response:
            self.log_test("Test SMS Endpoint", False, f"Response: {response}")
            return False
        
        # Test check reminders endpoint
        success, response = self.make_request('POST', 'reminders/check', None, 200)
        if not success:
            self.log_test("Check Reminders Endpoint", False, f"Response: {response}")
            return False
        
        self.log_test("Reminder Endpoints", True)
        return True

    def test_cleanup(self):
        """Clean up test data"""
        if self.test_account_id:
            success, response = self.make_request('DELETE', f'accounts/{self.test_account_id}', None, 200)
            if success:
                self.log_test("Cleanup Test Account", True)
                return True
            else:
                self.log_test("Cleanup Test Account", False, f"Response: {response}")
                return False
        return True

    def run_all_tests(self):
        """Run all enhanced feature tests"""
        print("🚀 Starting Enhanced Features API Tests")
        print(f"📡 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Authentication with phone number
        print("\n🔐 Enhanced Authentication Tests")
        if not self.test_user_registration_with_phone():
            print("❌ Registration with phone failed - stopping tests")
            return self.get_summary()
        
        self.test_update_user_phone()
        
        # Account management with enhanced features
        print("\n🏢 Enhanced Account Management Tests")
        if not self.test_create_account_with_status():
            print("❌ Account creation with status failed - skipping related tests")
            return self.get_summary()
        
        self.test_billing_day_validation()
        self.test_account_status_filter()
        self.test_update_account_status()
        
        # Enhanced billing features
        print("\n💳 Enhanced Billing Tests")
        self.test_payment_record_with_paid_status()
        
        # Notification features
        print("\n🔔 Notification Tests")
        self.test_notification_endpoints()
        self.test_reminder_endpoints()
        
        # Cleanup
        print("\n🧹 Cleanup")
        self.test_cleanup()
        
        return self.get_summary()

    def get_summary(self):
        """Get test summary"""
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        summary = {
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "failed_tests": self.tests_run - self.tests_passed,
            "success_rate": f"{success_rate:.1f}%",
            "test_results": self.test_results
        }
        
        print("\n" + "=" * 60)
        print("📋 ENHANCED FEATURES TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if self.tests_run - self.tests_passed > 0:
            print("\n❌ Failed Tests:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['details']}")
        
        return summary

def main():
    """Main test execution"""
    tester = EnhancedFeaturesAPITester()
    summary = tester.run_all_tests()
    
    # Return appropriate exit code
    return 0 if summary['failed_tests'] == 0 else 1

if __name__ == "__main__":
    sys.exit(main())