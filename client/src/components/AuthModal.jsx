import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const AuthModal = ({ isOpen, onClose, mode, onSwitchMode }) => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    username: "",
    location: ""
  });
  
  const { login, register } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (mode === "login") {
      const result = await login(formData.email, formData.password);
      if (result.success) {
        onClose();
        toast({
          title: "Welcome back!",
          description: "You have been logged in successfully.",
        });
      } else {
        toast({
          title: "Login Failed",
          description: result.error,
          variant: "destructive",
        });
      }
    } else {
      const result = await register({
        ...formData,
        skillsOffered: [],
        skillsWanted: [],
        availability: ["flexible"],
        avatar: null,
      });
      
      if (result.success) {
        onClose();
        toast({
          title: "Account Created!",
          description: "Welcome to the Skill Swap Platform!",
        });
      } else {
        toast({
          title: "Registration Failed",
          description: result.error,
          variant: "destructive",
        });
      }
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="liquid-crystal border-border">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">
            {mode === "login" ? "Login" : "Create Account"}
          </DialogTitle>
          <p className="text-center text-muted-foreground">
            {mode === "login" ? "Sign in to your account" : "Join our skill swap community"}
          </p>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <>
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Enter your full name"
                  className="bg-background border-border"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleInputChange("username", e.target.value)}
                  placeholder="Choose a username"
                  className="bg-background border-border"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="location">Location (Optional)</Label>
                <Input
                  id="location"
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleInputChange("location", e.target.value)}
                  placeholder="e.g., San Francisco, CA"
                  className="bg-background border-border"
                />
              </div>
            </>
          )}
          
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              placeholder="Enter your email"
              className="bg-background border-border"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => handleInputChange("password", e.target.value)}
              placeholder={mode === "login" ? "Enter your password" : "Create a password"}
              className="bg-background border-border"
              required
            />
          </div>
          
          <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground glow-effect">
            {mode === "login" ? "Login" : "Create Account"}
          </Button>
          
          {mode === "login" && (
            <div className="text-center">
              <button type="button" className="text-primary hover:text-primary/80 text-sm">
                Forgot your password?
              </button>
            </div>
          )}
          
          <div className="text-center">
            <p className="text-muted-foreground text-sm">
              {mode === "login" ? "Don't have an account?" : "Already have an account?"}
            </p>
            <Button 
              type="button" 
              variant="link"
              onClick={onSwitchMode}
              className="text-primary hover:text-primary/80 p-0 h-auto"
            >
              {mode === "login" ? "Create Account" : "Login"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;
