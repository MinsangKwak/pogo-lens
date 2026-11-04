import {Share} from 'react-native';

export async function shareCollectionJSON(json: string): Promise<void> {
  await Share.share({title: 'PoGo Lens 보유 기록', message: json});
}
