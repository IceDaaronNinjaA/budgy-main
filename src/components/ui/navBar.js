import { Image } from 'expo-image';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const navItems = [
  { path: '/', label: 'Home', icon: require('@/assets/icons/navMenu/home.svg') },
  { path: '/transactions', label: 'Transactions', icon: require('@/assets/icons/navMenu/transaction.svg') },
  { path: '/goals', label: 'Goals', icon: require('@/assets/icons/navMenu/goals.svg') },
  { path: '/settings', label: 'Profile', icon: require('@/assets/icons/navMenu/profile.svg') },
];

export default function NavBar({ onAddPress }) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const handleAddPress = onAddPress ?? (() => router.push('/add-transaction'));

  const navigateTo = (path) => {
    if (pathname !== path) {
      router.replace(path);
    }
  };

  const renderNavItem = ({ path, label, icon }) => {
    const focused = pathname === path;

    return (
      <Pressable
        key={path}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        onPress={() => navigateTo(path)}
        style={[
          styles.navItem,
          path === '/transactions' && styles.transactionsNavItem,
          path === '/goals' && styles.goalsNavItem,
        ]}
      >
        <Image source={icon} style={[styles.navIcon, !focused && styles.inactiveIcon]} contentFit="contain" />
        <Text style={[styles.navLabel, focused && styles.activeLabel]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View pointerEvents="none" style={styles.backgroundLayer}>
        <View style={styles.leftBackground} />
        <View style={styles.rightBackground} />
        <View style={styles.centerBackground} />
      </View>
      <View style={styles.navContent}>
        {navItems.slice(0, 2).map(renderNavItem)}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add"
          onPress={handleAddPress}
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
        >
          <Image
            source={require('@/assets/icons/navMenu/add.svg')}
            style={styles.addIcon}
            contentFit="contain"
          />
        </Pressable>

        {navItems.slice(2).map(renderNavItem)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    backgroundColor: 'transparent',
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  leftBackground: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: '50%',
    marginRight: 38,
    backgroundColor: '#FFFFFF',
    borderTopRightRadius: 38,
  },
  rightBackground: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    right: 0,
    marginLeft: 38,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 38,
  },
  centerBackground: {
    position: 'absolute',
    top: 38,
    bottom: 0,
    left: '50%',
    width: 76,
    marginLeft: -38,
    backgroundColor: '#FFFFFF',
  },
  navContent: {
    position: 'relative',
    width: '100%',
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 0,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  transactionsNavItem: {
    transform: [{ translateX: -12 }],
  },
  goalsNavItem: {
    transform: [{ translateX: 12 }],
  },
  navIcon: {
    width: 21,
    height: 21,
  },
  inactiveIcon: {
    opacity: 0.7,
  },
  navLabel: {
    color: '#6B757D',
    fontSize: 11,
  },
  activeLabel: {
    color: '#1F2A33',
    fontWeight: '600',
  },
  addButton: {
    position: 'absolute',
    left: '50%',
    top: -25,
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -29,
    borderRadius: 29,
    backgroundColor: '#FFC531',
    borderWidth: 4,
    borderColor: 'transparent',
    shadowColor: '#1F2A33',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 5,
    elevation: 4,
    zIndex: 2,
  },
  addButtonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
  addIcon: {
    width: 18,
    height: 18,
  },
});
