import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  ToastAndroid,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AlertCircle,
  ClipboardCheck,
  Droplets,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Sun,
} from 'lucide-react-native';

import { useAuth } from '../../auth/AuthContext';
import {
  Alert as AlertBanner,
  AlertDescription,
  AlertTitle,
} from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Separator } from '../../components/ui/separator';
import { Text } from '../../components/ui/text';

const APP_VERSION = '0.0.1';

const CAPABILITIES = [
  { icon: Droplets, label: 'Water systems' },
  { icon: Sun, label: 'Solar energy' },
  { icon: ClipboardCheck, label: 'MRV verification' },
] as const;

function CapabilityPill({
  icon: Icon,
  label,
}: {
  icon: (typeof CAPABILITIES)[number]['icon'];
  label: string;
}) {
  return (
    <View className="flex-row items-center gap-1.5 rounded-full border border-primary-foreground/15 bg-primary-foreground/10 px-2.5 py-1">
      <Icon color="rgba(248, 250, 252, 0.85)" size={12} strokeWidth={2.25} />
      <Text className="text-[10px] font-medium text-primary-foreground/90">
        {label}
      </Text>
    </View>
  );
}

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    }
    Alert.alert('Login', message);
  };

  const onSubmit = async () => {
    setErrorMessage(null);
    if (!email.trim() || !password) {
      const msg = 'Please enter email and password.';
      setErrorMessage(msg);
      showToast(msg);
      return;
    }

    setSubmitting(true);
    try {
      const res = await login(email.trim(), password);
      if (!res.ok) {
        setErrorMessage(res.message);
        showToast(res.message);
        return;
      }
      setErrorMessage(null);
      showToast('Login successful.');
    } catch {
      const msg = 'Unexpected error during login.';
      setErrorMessage(msg);
      showToast(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle="light-content" backgroundColor="hsl(222.2 47.4% 11.2%)" />

      <SafeAreaView className="flex-1" edges={['bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View className="bg-primary px-6 pb-16 pt-4">
              <View
                pointerEvents="none"
                className="absolute -right-10 -top-8 h-40 w-40 rounded-full bg-primary-foreground/5"
              />
              <View
                pointerEvents="none"
                className="absolute -left-16 bottom-0 h-32 w-32 rounded-full bg-primary-foreground/5"
              />

              <SafeAreaView edges={['top']}>
                <View className="items-center">
                  <Badge
                    variant="outline"
                    className="mb-5 border-primary-foreground/20 bg-primary-foreground/10"
                  >
                    <Text className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-foreground/90">
                      Operator portal
                    </Text>
                  </Badge>

                  <View
                    className="mb-5 items-center justify-center rounded-2xl border border-primary-foreground/10 bg-white px-6 py-4"
                    style={styles.logoPanel}
                  >
                    <Image
                      source={require('../../assets/prmsc-logo.png')}
                      className="h-24 w-52"
                      resizeMode="contain"
                      accessibilityLabel="PRMSC logo"
                    />
                  </View>

                  <Text className="text-center text-2xl font-bold tracking-tight text-primary-foreground">
                    MRV Operator
                  </Text>
                  <Text className="mt-2 max-w-xs text-center text-sm leading-5 text-primary-foreground/75">
                    Monitoring, Reporting & Verification for field operations
                  </Text>
                  <Text className="mt-1 text-center text-xs text-primary-foreground/55">
                    Punjab Rural Municipal Services Company
                  </Text>

                  <View className="mt-5 flex-row flex-wrap items-center justify-center gap-2">
                    {CAPABILITIES.map(item => (
                      <CapabilityPill
                        key={item.label}
                        icon={item.icon}
                        label={item.label}
                      />
                    ))}
                  </View>
                </View>
              </SafeAreaView>
            </View>

            <View className="-mt-10 px-5">
              <Card
                className="overflow-hidden rounded-2xl border-border/70 bg-card py-0 shadow-lg shadow-black/10"
                style={styles.formCard}
              >
                <View className="border-b border-border/60 bg-muted/40 px-6 py-4">
                  <CardHeader className="gap-1 p-0">
                    <Text className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      Secure sign in
                    </Text>
                    <CardTitle className="text-xl font-bold tracking-tight text-foreground">
                      Access your workspace
                    </CardTitle>
                    <CardDescription className="text-sm leading-5">
                      Use your assigned PRMSC operator credentials to continue.
                    </CardDescription>
                  </CardHeader>
                </View>

                <CardContent className="gap-5 px-6 py-5">
                  {errorMessage ? (
                    <AlertBanner
                      icon={AlertCircle}
                      variant="destructive"
                      className="border-destructive/30"
                    >
                      <AlertTitle>Could not sign in</AlertTitle>
                      <AlertDescription>{errorMessage}</AlertDescription>
                    </AlertBanner>
                  ) : null}

                  <View className="gap-4">
                    <View className="gap-2">
                      <Label
                        nativeID="email"
                        className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                      >
                        Email address
                      </Label>
                      <View className="relative">
                        <View className="pointer-events-none absolute left-3.5 top-0 z-[1] h-12 justify-center">
                          <Mail className="text-muted-foreground" size={18} />
                        </View>
                        <Input
                          value={email}
                          onChangeText={t => {
                            setEmail(t);
                            if (errorMessage) setErrorMessage(null);
                          }}
                          autoCapitalize="none"
                          autoCorrect={false}
                          keyboardType="email-address"
                          textContentType="username"
                          autoComplete="email"
                          placeholder="name@prmsc.gov.pk"
                          className="h-12 rounded-lg border-input bg-background pl-11 text-[15px]"
                          accessibilityLabel="Email address"
                        />
                      </View>
                    </View>

                    <View className="gap-2">
                      <Label
                        nativeID="password"
                        className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                      >
                        Password
                      </Label>
                      <View className="relative">
                        <View className="pointer-events-none absolute left-3.5 top-0 z-[1] h-12 justify-center">
                          <Lock className="text-muted-foreground" size={18} />
                        </View>
                        <Input
                          value={password}
                          onChangeText={t => {
                            setPassword(t);
                            if (errorMessage) setErrorMessage(null);
                          }}
                          secureTextEntry={!showPassword}
                          textContentType="password"
                          autoComplete="password"
                          placeholder="Enter your password"
                          className="h-12 rounded-lg border-input bg-background pl-11 pr-12 text-[15px]"
                          accessibilityLabel="Password"
                          onSubmitEditing={onSubmit}
                          returnKeyType="go"
                        />
                        <Pressable
                          className="absolute right-1 top-0 z-[1] h-12 justify-center rounded-md px-3 active:opacity-70"
                          onPress={() => setShowPassword(v => !v)}
                          accessibilityRole="button"
                          accessibilityLabel={
                            showPassword ? 'Hide password' : 'Show password'
                          }
                        >
                          {showPassword ? (
                            <EyeOff
                              className="text-muted-foreground"
                              size={20}
                            />
                          ) : (
                            <Eye className="text-muted-foreground" size={20} />
                          )}
                        </Pressable>
                      </View>
                    </View>
                  </View>

                  <Separator className="bg-border/60" />

                  <Button
                    size="lg"
                    className="h-12 w-full rounded-lg"
                    onPress={onSubmit}
                    disabled={submitting}
                    accessibilityLabel="Sign in"
                  >
                    {submitting ? (
                      <View className="flex-row items-center gap-2">
                        <ActivityIndicator color="#fff" />
                        <Text className="font-semibold text-primary-foreground">
                          Signing in…
                        </Text>
                      </View>
                    ) : (
                      <Text className="font-semibold text-primary-foreground">
                        Sign in to portal
                      </Text>
                    )}
                  </Button>

                  <View className="flex-row items-start gap-2.5 rounded-lg border border-border/60 bg-muted/30 px-3 py-3">
                    <ShieldCheck
                      className="mt-0.5 text-muted-foreground"
                      size={16}
                    />
                    <Text className="flex-1 text-[11px] leading-4 text-muted-foreground">
                      Authorized PRMSC personnel only. Activity may be logged
                      for compliance and audit purposes.
                    </Text>
                  </View>
                </CardContent>
              </Card>
            </View>

            <View className="mt-6 items-center px-6 pb-8">
              <Text className="text-center text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                PRMSC MRV Operator · v{APP_VERSION}
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 8,
  },
  logoPanel: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
      default: {},
    }),
  },
  formCard: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: {
        elevation: 6,
      },
      default: {},
    }),
  },
});
