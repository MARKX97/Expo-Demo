import { StyleSheet, Text, View } from 'react-native';

export default function IndexScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>电梯故障派工</Text>
      <Text style={styles.caption}>Expo 项目骨架</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#f7f8fa',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#18212b',
    fontSize: 24,
    fontWeight: '700',
  },
  caption: {
    color: '#66717d',
    fontSize: 15,
    marginTop: 8,
  },
});
