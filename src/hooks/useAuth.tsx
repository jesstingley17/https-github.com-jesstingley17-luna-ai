import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { AuthContextType, User, Session, UserProfile, AuthError } from '@/integrations/supabase/types'
import { toast } from '@/hooks/use-toast'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        toast({
          title: 'Sign up failed',
          description: error.message,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Check your email',
          description: 'We sent you a confirmation link.',
        })
      }

      return { error }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('An unknown error occurred')
      toast({
        title: 'Sign up failed',
        description: error.message,
        variant: 'destructive',
      })
      return { error: { message: error.message, status: 500 } as AuthError }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        toast({
          title: 'Sign in failed',
          description: error.message,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Welcome back!',
          description: 'You have successfully signed in.',
        })
      }

      return { error }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('An unknown error occurred')
      toast({
        title: 'Sign in failed',
        description: error.message,
        variant: 'destructive',
      })
      return { error: { message: error.message, status: 500 } as AuthError }
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        toast({
          title: 'Sign out failed',
          description: error.message,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Signed out',
          description: 'You have been signed out successfully.',
        })
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('An unknown error occurred')
      toast({
        title: 'Sign out failed',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        toast({
          title: 'Password reset failed',
          description: error.message,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Check your email',
          description: 'We sent you a password reset link.',
        })
      }

      return { error }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('An unknown error occurred')
      toast({
        title: 'Password reset failed',
        description: error.message,
        variant: 'destructive',
      })
      return { error: { message: error.message, status: 500 } as AuthError }
    }
  }

  const updateProfile = async (data: Partial<UserProfile>) => {
    try {
      if (!user) {
        throw new Error('No user logged in')
      }

      const { error } = await supabase.auth.updateUser({
        data,
      })

      if (error) {
        toast({
          title: 'Profile update failed',
          description: error.message,
          variant: 'destructive',
        })
        return { error }
      }

      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
      })

      return { error: null }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('An unknown error occurred')
      toast({
        title: 'Profile update failed',
        description: error.message,
        variant: 'destructive',
      })
      return { error }
    }
  }

  const value: AuthContextType = {
    user,
    session,
    loading,
    isAuthenticated: !!user,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updateProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
