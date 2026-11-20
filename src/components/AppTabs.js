import { router, Tabs } from 'expo-router';
import NavBar from '@/components/ui/navBar';

export default function AppTabs() {
  return (
    <Tabs
      tabBar={(props) => <NavBar {...props} onAddPress={() => router.push('/add-transaction')} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="transactions" options={{ title: 'Summary', tabBarAccessibilityLabel: 'Summary' }} />
      <Tabs.Screen name="goals" options={{ title: 'Goals' }} />
      <Tabs.Screen name="settings" options={{ title: 'Profile' }} />
      <Tabs.Screen name="budgets" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="add-transaction" options={{ href: null }} />
    </Tabs>
  );
}
