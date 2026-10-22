import { TextField } from './TextField';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  label?: string;
  placeholder?: string;
}

export function SearchField({
  value,
  onChangeText,
  label = 'Buscar',
  placeholder = 'Buscar por nombre',
}: Props) {
  return (
    <TextField
      autoCapitalize="none"
      icon="search"
      label={label}
      onChangeText={onChangeText}
      onClear={() => onChangeText('')}
      placeholder={placeholder}
      returnKeyType="search"
      value={value}
    />
  );
}
