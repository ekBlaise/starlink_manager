import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth, API } from "@/App";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function GmailCallback() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState("processing");
  const [message, setMessage] = useState("Connecting Gmail...");
  
  const headers = auth.token ? { Authorization: `Bearer ${auth.token}` } : {};

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const error = params.get('error');
      
      // Get the account ID from localStorage
      const accountId = localStorage.getItem('gmail_connect_account_id');
      
      if (error) {
        setStatus("error");
        setMessage("Gmail authorization was cancelled or denied.");
        setTimeout(() => {
          if (accountId) {
            navigate(`/accounts/${accountId}`);
          } else {
            navigate('/accounts');
          }
        }, 2000);
        return;
      }
      
      if (!code) {
        setStatus("error");
        setMessage("No authorization code received.");
        setTimeout(() => navigate('/accounts'), 2000);
        return;
      }
      
      if (!accountId) {
        setStatus("error");
        setMessage("Could not determine which account to connect.");
        setTimeout(() => navigate('/accounts'), 2000);
        return;
      }
      
      try {
        const response = await fetch(`${API}/accounts/${accountId}/gmail/connect`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          credentials: "include",
          body: JSON.stringify({ 
            code, 
            redirect_uri: window.location.origin + '/gmail-callback' 
          }),
        });
        
        const data = await response.json();
        
        if (response.ok) {
          setStatus("success");
          setMessage("Gmail connected successfully!");
          toast.success("Gmail connected!");
          // Clean up localStorage
          localStorage.removeItem('gmail_connect_account_id');
          setTimeout(() => navigate(`/accounts/${accountId}`), 1500);
        } else {
          setStatus("error");
          setMessage(data.detail || "Failed to connect Gmail.");
          setTimeout(() => navigate(`/accounts/${accountId}`), 2000);
        }
      } catch (error) {
        setStatus("error");
        setMessage("Connection error. Please try again.");
        setTimeout(() => navigate(`/accounts/${accountId}`), 2000);
      }
    };
    
    handleCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {status === "processing" && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-cyan-500 mx-auto" />
            <p className="text-lg text-muted-foreground">{message}</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <p className="text-lg text-green-500">{message}</p>
            <p className="text-sm text-muted-foreground">Redirecting...</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto" />
            <p className="text-lg text-red-500">{message}</p>
            <p className="text-sm text-muted-foreground">Redirecting...</p>
          </>
        )}
      </div>
    </div>
  );
}
