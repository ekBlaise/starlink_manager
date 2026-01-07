#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional

class StarlinkAPITester:
    def __init__(self, base_url="https://starops-manager.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test data storage
        self.test_account_id = None
        self.test_billing_id = None
        self.test_ticket_id = None
        self.test_extender_id = None
        self.test_device_id = None

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

    def test_user_registration(self):
        """Test user registration"""
        timestamp = int(datetime.now().timestamp())
        test_user = {
            "name": f"Test User {timestamp}",
            "email": f"test.user.{timestamp}@example.com",
            "password": "TestPass123!"
        }
        
        success, response = self.make_request('POST', 'auth/register', test_user, 200)
        if success and 'token' in response:
            self.token = response['token']
            self.user_data = response['user']
            self.log_test("User Registration", True)
            return True
        else:
            self.log_test("User Registration", False, f"Response: {response}")
            return False

    def test_user_login(self):
        """Test user login with existing credentials"""
        if not self.user_data:
            self.log_test("User Login", False, "No user data from registration")
            return False
            
        login_data = {
            "email": self.user_data['email'],
            "password": "TestPass123!"
        }
        
        success, response = self.make_request('POST', 'auth/login', login_data, 200)
        if success and 'token' in response:
            self.token = response['token']  # Update token
            self.log_test("User Login", True)
            return True
        else:
            self.log_test("User Login", False, f"Response: {response}")
            return False

    def test_existing_user_login(self):
        """Test login with the specific test credentials from review request"""
        login_data = {
            "email": "test@example.com",
            "password": "Test123!"
        }
        
        success, response = self.make_request('POST', 'auth/login', login_data, 200)
        if success and 'token' in response:
            self.token = response['token']  # Update token for subsequent tests
            self.user_data = response['user']
            self.log_test("Existing User Login (test@example.com)", True)
            return True
        else:
            self.log_test("Existing User Login (test@example.com)", False, f"Response: {response}")
            return False

    def test_auth_me(self):
        """Test getting current user info"""
        success, response = self.make_request('GET', 'auth/me', None, 200)
        if success and 'user_id' in response:
            self.log_test("Auth Me Endpoint", True)
            return True
        else:
            self.log_test("Auth Me Endpoint", False, f"Response: {response}")
            return False

    def test_update_user_profile(self):
        """Test updating user profile (PUT /api/auth/me)"""
        update_data = {
            "phone_number": "+1234567890"
        }
        
        success, response = self.make_request('PUT', 'auth/me', update_data, 200)
        if success and response.get('phone_number') == "+1234567890":
            self.log_test("Update User Profile", True)
            return True
        else:
            self.log_test("Update User Profile", False, f"Response: {response}")
            return False

    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        success, response = self.make_request('GET', 'dashboard/stats', None, 200)
        if success and 'total_accounts' in response:
            self.log_test("Dashboard Stats", True)
            return True
        else:
            self.log_test("Dashboard Stats", False, f"Response: {response}")
            return False

    def test_create_account(self):
        """Test creating a Starlink account"""
        account_data = {
            "account_name": "Test Starlink Account",
            "location": "Test City, NY",
            "account_email": "starlink.test@example.com",
            "kit_number": "UT-12345-67890",
            "notes": "Test account for automated testing",
            "billing_day": 15,
            "monthly_amount": 120.00
        }
        
        success, response = self.make_request('POST', 'accounts', account_data, 200)
        if success and 'account_id' in response:
            self.test_account_id = response['account_id']
            self.log_test("Create Starlink Account", True)
            return True
        else:
            self.log_test("Create Starlink Account", False, f"Response: {response}")
            return False

    def test_get_accounts(self):
        """Test getting accounts list"""
        success, response = self.make_request('GET', 'accounts', None, 200)
        if success and isinstance(response, list):
            self.log_test("Get Accounts List", True)
            return True
        else:
            self.log_test("Get Accounts List", False, f"Response: {response}")
            return False

    def test_get_account_detail(self):
        """Test getting specific account details"""
        if not self.test_account_id:
            self.log_test("Get Account Detail", False, "No test account ID")
            return False
            
        success, response = self.make_request('GET', f'accounts/{self.test_account_id}', None, 200)
        if success and response.get('account_id') == self.test_account_id:
            self.log_test("Get Account Detail", True)
            return True
        else:
            self.log_test("Get Account Detail", False, f"Response: {response}")
            return False

    def test_search_accounts(self):
        """Test account search functionality"""
        success, response = self.make_request('GET', 'accounts?search=Test', None, 200)
        if success and isinstance(response, list):
            self.log_test("Search Accounts", True)
            return True
        else:
            self.log_test("Search Accounts", False, f"Response: {response}")
            return False

    def test_filter_accounts(self):
        """Test account filtering by status"""
        success, response = self.make_request('GET', 'accounts?status=online', None, 200)
        if success and isinstance(response, list):
            self.log_test("Filter Accounts by Status", True)
            return True
        else:
            self.log_test("Filter Accounts by Status", False, f"Response: {response}")
            return False

    def test_update_account(self):
        """Test updating account details"""
        if not self.test_account_id:
            self.log_test("Update Account", False, "No test account ID")
            return False
            
        update_data = {
            "account_name": "Updated Test Account",
            "monthly_amount": 130.00,
            "notes": "Updated notes for testing"
        }
        
        success, response = self.make_request('PUT', f'accounts/{self.test_account_id}', update_data, 200)
        if success and response.get('account_name') == "Updated Test Account":
            self.log_test("Update Account", True)
            return True
        else:
            self.log_test("Update Account", False, f"Response: {response}")
            return False

    def test_add_payment_record(self):
        """Test adding payment record to account"""
        if not self.test_account_id:
            self.log_test("Add Payment Record", False, "No test account ID")
            return False
            
        payment_data = {
            "amount": 120.00,
            "payment_date": datetime.now(timezone.utc).isoformat(),
            "payment_method": "credit_card",
            "notes": "Test payment record"
        }
        
        success, response = self.make_request('POST', f'accounts/{self.test_account_id}/billing', payment_data, 200)
        if success and 'billing_id' in response:
            self.test_billing_id = response['billing_id']
            self.log_test("Add Payment Record", True)
            return True
        else:
            self.log_test("Add Payment Record", False, f"Response: {response}")
            return False

    def test_get_billing_records(self):
        """Test getting billing records for account"""
        if not self.test_account_id:
            self.log_test("Get Billing Records", False, "No test account ID")
            return False
            
        success, response = self.make_request('GET', f'accounts/{self.test_account_id}/billing', None, 200)
        if success and isinstance(response, list):
            self.log_test("Get Billing Records", True)
            return True
        else:
            self.log_test("Get Billing Records", False, f"Response: {response}")
            return False

    def test_create_support_ticket(self):
        """Test creating support ticket"""
        if not self.test_account_id:
            self.log_test("Create Support Ticket", False, "No test account ID")
            return False
            
        ticket_data = {
            "title": "Test Support Issue",
            "description": "This is a test support ticket for automated testing",
            "priority": "medium"
        }
        
        success, response = self.make_request('POST', f'accounts/{self.test_account_id}/tickets', ticket_data, 200)
        if success and 'ticket_id' in response:
            self.test_ticket_id = response['ticket_id']
            self.log_test("Create Support Ticket", True)
            return True
        else:
            self.log_test("Create Support Ticket", False, f"Response: {response}")
            return False

    def test_get_support_tickets(self):
        """Test getting support tickets for account"""
        if not self.test_account_id:
            self.log_test("Get Support Tickets", False, "No test account ID")
            return False
            
        success, response = self.make_request('GET', f'accounts/{self.test_account_id}/tickets', None, 200)
        if success and isinstance(response, list):
            self.log_test("Get Support Tickets", True)
            return True
        else:
            self.log_test("Get Support Tickets", False, f"Response: {response}")
            return False

    def test_close_support_ticket(self):
        """Test closing support ticket"""
        if not self.test_account_id or not self.test_ticket_id:
            self.log_test("Close Support Ticket", False, "No test account or ticket ID")
            return False
            
        update_data = {"status": "closed"}
        
        success, response = self.make_request('PUT', f'accounts/{self.test_account_id}/tickets/{self.test_ticket_id}', update_data, 200)
        if success and response.get('status') == 'closed':
            self.log_test("Close Support Ticket", True)
            return True
        else:
            self.log_test("Close Support Ticket", False, f"Response: {response}")
            return False

    def test_add_extender(self):
        """Test adding extender/sub-router"""
        if not self.test_account_id:
            self.log_test("Add Extender", False, "No test account ID")
            return False
            
        extender_data = {
            "name": "Test Extender",
            "ip_address": "192.168.1.100",
            "location": "Second Floor"
        }
        
        success, response = self.make_request('POST', f'accounts/{self.test_account_id}/extenders', extender_data, 200)
        if success and 'extender_id' in response:
            self.test_extender_id = response['extender_id']
            self.log_test("Add Extender", True)
            return True
        else:
            self.log_test("Add Extender", False, f"Response: {response}")
            return False

    def test_get_extenders(self):
        """Test getting extenders for account"""
        if not self.test_account_id:
            self.log_test("Get Extenders", False, "No test account ID")
            return False
            
        success, response = self.make_request('GET', f'accounts/{self.test_account_id}/extenders', None, 200)
        if success and isinstance(response, list):
            self.log_test("Get Extenders", True)
            return True
        else:
            self.log_test("Get Extenders", False, f"Response: {response}")
            return False

    def test_add_device(self):
        """Test adding device to account"""
        if not self.test_account_id:
            self.log_test("Add Device", False, "No test account ID")
            return False
            
        device_data = {
            "name": "Test iPhone",
            "mac_address": "AA:BB:CC:DD:EE:FF",
            "device_type": "phone",
            "extender_id": self.test_extender_id  # Can be None
        }
        
        success, response = self.make_request('POST', f'accounts/{self.test_account_id}/devices', device_data, 200)
        if success and 'device_id' in response:
            self.test_device_id = response['device_id']
            self.log_test("Add Device", True)
            return True
        else:
            self.log_test("Add Device", False, f"Response: {response}")
            return False

    def test_get_devices(self):
        """Test getting devices for account"""
        if not self.test_account_id:
            self.log_test("Get Devices", False, "No test account ID")
            return False
            
        success, response = self.make_request('GET', f'accounts/{self.test_account_id}/devices', None, 200)
        if success and isinstance(response, list):
            self.log_test("Get Devices", True)
            return True
        else:
            self.log_test("Get Devices", False, f"Response: {response}")
            return False

    def test_toggle_device_whitelist(self):
        """Test toggling device whitelist status"""
        if not self.test_account_id or not self.test_device_id:
            self.log_test("Toggle Device Whitelist", False, "No test account or device ID")
            return False
            
        update_data = {"is_whitelisted": False}  # Block the device
        
        success, response = self.make_request('PUT', f'accounts/{self.test_account_id}/devices/{self.test_device_id}', update_data, 200)
        if success and response.get('is_whitelisted') == False:
            self.log_test("Toggle Device Whitelist", True)
            return True
        else:
            self.log_test("Toggle Device Whitelist", False, f"Response: {response}")
            return False

    def test_delete_account(self):
        """Test deleting account (cleanup)"""
        if not self.test_account_id:
            self.log_test("Delete Account", False, "No test account ID")
            return False
            
        success, response = self.make_request('DELETE', f'accounts/{self.test_account_id}', None, 200)
        if success:
            self.log_test("Delete Account", True)
            return True
        else:
            self.log_test("Delete Account", False, f"Response: {response}")
            return False

    def test_get_notifications(self):
        """Test getting notifications list"""
        success, response = self.make_request('GET', 'notifications', None, 200)
        if success and isinstance(response, list):
            self.log_test("Get Notifications", True)
            return True
        else:
            self.log_test("Get Notifications", False, f"Response: {response}")
            return False

    def test_get_notifications_count(self):
        """Test getting unread notifications count"""
        success, response = self.make_request('GET', 'notifications/count', None, 200)
        if success and 'unread_count' in response:
            self.log_test("Get Notifications Count", True)
            return True
        else:
            self.log_test("Get Notifications Count", False, f"Response: {response}")
            return False

    # ==================== GOOGLE OAUTH & GMAIL SYNC TESTS ====================
    
    def test_google_oauth_callback_missing_code(self):
        """Test Google OAuth callback with missing code"""
        success, response = self.make_request('POST', 'auth/google/callback', {}, 400)
        if success and 'Authorization code required' in response.get('detail', ''):
            self.log_test("Google OAuth Callback - Missing Code", True)
            return True
        else:
            self.log_test("Google OAuth Callback - Missing Code", False, f"Response: {response}")
            return False

    def test_google_oauth_callback_invalid_code(self):
        """Test Google OAuth callback with invalid code"""
        invalid_data = {
            "code": "invalid_auth_code_12345",
            "redirect_uri": "http://localhost:3000/login"
        }
        success, response = self.make_request('POST', 'auth/google/callback', invalid_data, 400)
        if success and ('error' in response.get('detail', '') or 'Failed to exchange code' in response.get('detail', '')):
            self.log_test("Google OAuth Callback - Invalid Code", True)
            return True
        else:
            self.log_test("Google OAuth Callback - Invalid Code", False, f"Response: {response}")
            return False

    def test_google_oauth_callback_valid_format(self):
        """Test Google OAuth callback with valid format (will fail due to invalid code but should accept format)"""
        valid_format_data = {
            "code": "4/0AeaYSHBqwX7VQxz123456789",  # Valid format but fake code
            "redirect_uri": "http://localhost:3000/login"
        }
        success, response = self.make_request('POST', 'auth/google/callback', valid_format_data, 400)
        # Should return 400 with Google-specific error, not format error
        if success and ('error' in response.get('detail', '') or 'Failed to exchange code' in response.get('detail', '')):
            self.log_test("Google OAuth Callback - Valid Format", True)
            return True
        else:
            self.log_test("Google OAuth Callback - Valid Format", False, f"Response: {response}")
            return False

    def test_gmail_status_unauthenticated(self):
        """Test Gmail status without authentication"""
        # Temporarily remove token
        original_token = self.token
        self.token = None
        success, response = self.make_request('GET', 'gmail/status', None, 401)
        self.token = original_token  # Restore token
        
        if success and 'Not authenticated' in response.get('detail', ''):
            self.log_test("Gmail Status - Unauthenticated", True)
            return True
        else:
            self.log_test("Gmail Status - Unauthenticated", False, f"Response: {response}")
            return False

    def test_gmail_status_authenticated(self):
        """Test Gmail status with authentication (should return not connected)"""
        success, response = self.make_request('GET', 'gmail/status', None, 200)
        if success and 'connected' in response and response['connected'] == False:
            self.log_test("Gmail Status - Authenticated (Not Connected)", True)
            return True
        else:
            self.log_test("Gmail Status - Authenticated (Not Connected)", False, f"Response: {response}")
            return False

    def test_gmail_disconnect_unauthenticated(self):
        """Test Gmail disconnect without authentication"""
        # Temporarily remove token
        original_token = self.token
        self.token = None
        success, response = self.make_request('POST', 'gmail/disconnect', {}, 401)
        self.token = original_token  # Restore token
        
        if success and 'Not authenticated' in response.get('detail', ''):
            self.log_test("Gmail Disconnect - Unauthenticated", True)
            return True
        else:
            self.log_test("Gmail Disconnect - Unauthenticated", False, f"Response: {response}")
            return False

    def test_gmail_disconnect_authenticated(self):
        """Test Gmail disconnect with authentication"""
        success, response = self.make_request('POST', 'gmail/disconnect', {}, 200)
        if success and 'message' in response and 'disconnected' in response['message'].lower():
            self.log_test("Gmail Disconnect - Authenticated", True)
            return True
        else:
            self.log_test("Gmail Disconnect - Authenticated", False, f"Response: {response}")
            return False

    def test_gmail_sync_unauthenticated(self):
        """Test Gmail sync without authentication"""
        # Temporarily remove token
        original_token = self.token
        self.token = None
        success, response = self.make_request('POST', 'gmail/sync', {}, 401)
        self.token = original_token  # Restore token
        
        if success and 'Not authenticated' in response.get('detail', ''):
            self.log_test("Gmail Sync - Unauthenticated", True)
            return True
        else:
            self.log_test("Gmail Sync - Unauthenticated", False, f"Response: {response}")
            return False

    def test_gmail_sync_not_connected(self):
        """Test Gmail sync when Gmail is not connected"""
        success, response = self.make_request('POST', 'gmail/sync', {}, 400)
        if success and 'Gmail not connected' in response.get('detail', ''):
            self.log_test("Gmail Sync - Not Connected", True)
            return True
        else:
            self.log_test("Gmail Sync - Not Connected", False, f"Response: {response}")
            return False

    def test_gmail_emails_unauthenticated(self):
        """Test Gmail emails without authentication"""
        # Temporarily remove token
        original_token = self.token
        self.token = None
        success, response = self.make_request('GET', 'gmail/emails', None, 401)
        self.token = original_token  # Restore token
        
        if success and 'Not authenticated' in response.get('detail', ''):
            self.log_test("Gmail Emails - Unauthenticated", True)
            return True
        else:
            self.log_test("Gmail Emails - Unauthenticated", False, f"Response: {response}")
            return False

    def test_gmail_emails_authenticated(self):
        """Test Gmail emails with authentication (should return empty list)"""
        success, response = self.make_request('GET', 'gmail/emails', None, 200)
        if success and isinstance(response, list):
            self.log_test("Gmail Emails - Authenticated", True)
            return True
        else:
            self.log_test("Gmail Emails - Authenticated", False, f"Response: {response}")
            return False

    def run_all_tests(self):
        """Run all API tests in sequence"""
        print("🚀 Starting Starlink Manager API Tests")
        print(f"📡 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Authentication Tests
        print("\n🔐 Authentication Tests")
        
        # First try with existing test credentials
        if self.test_existing_user_login():
            print("✅ Using existing test credentials")
        else:
            # Fall back to registration flow
            if not self.test_user_registration():
                print("❌ Registration failed - stopping tests")
                return self.get_summary()
                
            if not self.test_user_login():
                print("❌ Login failed - stopping tests")
                return self.get_summary()
            
        self.test_auth_me()
        self.test_update_user_profile()
        
        # Dashboard Tests
        print("\n📊 Dashboard Tests")
        self.test_dashboard_stats()
        
        # Account Management Tests
        print("\n🏢 Account Management Tests")
        if not self.test_create_account():
            print("❌ Account creation failed - skipping related tests")
            return self.get_summary()
            
        self.test_get_accounts()
        self.test_get_account_detail()
        self.test_search_accounts()
        self.test_filter_accounts()
        self.test_update_account()
        
        # Billing Tests
        print("\n💳 Billing Tests")
        self.test_add_payment_record()
        self.test_get_billing_records()
        
        # Support Ticket Tests
        print("\n🎫 Support Ticket Tests")
        self.test_create_support_ticket()
        self.test_get_support_tickets()
        self.test_close_support_ticket()
        
        # Network Equipment Tests
        print("\n📡 Network Equipment Tests")
        self.test_add_extender()
        self.test_get_extenders()
        self.test_add_device()
        self.test_get_devices()
        self.test_toggle_device_whitelist()
        
        # Cleanup
        print("\n🧹 Cleanup Tests")
        self.test_delete_account()
        
        # Notifications Tests
        print("\n🔔 Notifications Tests")
        self.test_get_notifications()
        self.test_get_notifications_count()
        
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
        print("📋 TEST SUMMARY")
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
    tester = StarlinkAPITester()
    summary = tester.run_all_tests()
    
    # Return appropriate exit code
    return 0 if summary['failed_tests'] == 0 else 1

if __name__ == "__main__":
    sys.exit(main())