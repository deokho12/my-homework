import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';

function TabIcon({ emoji, color }: { emoji: string; color: ColorValue }) {
  return <Text style={{ fontSize: 20, color }}>{emoji}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#17847a',
        tabBarInactiveTintColor: '#a3a3a3',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ color }) => <TabIcon emoji="🏠" color={color} />,
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: '카테고리',
          tabBarIcon: ({ color }) => <TabIcon emoji="🦷" color={color} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: '찜',
          tabBarIcon: ({ color }) => <TabIcon emoji="❤️" color={color} />,
        }}
      />
    </Tabs>
  );
}
