# backend/usuario/serializers.py
from rest_framework import serializers
from usuario.models import Usuario, Perfil, Funcionalidade
from conteudo.models import Componente


class FuncionalidadeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Funcionalidade
        fields = ['id', 'nome', 'slug']


class ComponenteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Componente
        fields = ['id', 'nome', 'slug']


class PerfilSerializer(serializers.ModelSerializer):
    funcionalidades = FuncionalidadeSerializer(many=True, read_only=True)
    componentes = ComponenteSerializer(many=True, read_only=True)
    
    class Meta:
        model = Perfil
        fields = ['id', 'nome', 'funcionalidades', 'componentes']


class UsuarioAdminSerializer(serializers.ModelSerializer):
    """Serializer para listagem e detalhamento de usuários na área administrativa"""
    perfil_detalhado = PerfilSerializer(source='perfil', read_only=True)
    funcionalidades = serializers.SerializerMethodField()
    componentes = serializers.SerializerMethodField()
    perfil_id = serializers.IntegerField(source='perfil.id', read_only=True, allow_null=True)
    perfil_nome = serializers.CharField(source='perfil.nome', read_only=True, allow_null=True)
    
    class Meta:
        model = Usuario
        fields = [
            'id', 'nome', 'email', 'usuario', 'telefone',
            'tipo_documento', 'documento', 'plano', 'creditos',
            'is_active', 'criado_em', 'ultimo_login', 'expira_em',
            'perfil_id', 'perfil_nome', 'perfil_detalhado',
            'funcionalidades', 'componentes'
        ]
        read_only_fields = ['id', 'criado_em', 'ultimo_login']
    
    def get_funcionalidades(self, obj):
        if obj.perfil:
            return list(obj.perfil.funcionalidades.values('id', 'nome', 'slug'))
        return []
    
    def get_componentes(self, obj):
        if obj.perfil:
            return list(obj.perfil.componentes.values('id', 'nome', 'slug'))
        return []


class UsuarioCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criação e atualização de usuários"""
    perfil_id = serializers.IntegerField(required=False, allow_null=True)
    componentes_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True
    )
    senha = serializers.CharField(write_only=True, required=False)
    
    class Meta:
        model = Usuario
        fields = [
            'nome', 'email', 'usuario', 'telefone',
            'tipo_documento', 'documento', 'plano',
            'is_active', 'perfil_id', 'componentes_ids', 'senha'
        ]
    
    def validate_email(self, value):
        """Valida se o email é único (exceto para atualização)"""
        if self.instance is None:  # Criação
            if Usuario.objects.filter(email=value).exists():
                raise serializers.ValidationError("Este email já está em uso.")
        else:  # Atualização
            if Usuario.objects.filter(email=value).exclude(pk=self.instance.pk).exists():
                raise serializers.ValidationError("Este email já está em uso.")
        return value
    
    def create(self, validated_data):
        componentes_ids = validated_data.pop('componentes_ids', [])
        perfil_id = validated_data.pop('perfil_id', None)
        senha = validated_data.pop('senha', None)
        
        if not senha:
            raise serializers.ValidationError({"senha": "Senha é obrigatória na criação."})
        
        # Criar usuário
        usuario = Usuario.objects.create_user(
            senha=senha,
            **validated_data
        )
        
        # Associar perfil
        if perfil_id:
            try:
                perfil = Perfil.objects.get(pk=perfil_id)
                usuario.perfil = perfil
                usuario.save(update_fields=['perfil'])
            except Perfil.DoesNotExist:
                pass
        
        # Associar componentes
        if componentes_ids:
            if not usuario.perfil:
                perfil = Perfil.objects.create(nome=f"Perfil {usuario.id}")
                usuario.perfil = perfil
                usuario.save(update_fields=['perfil'])
            usuario.perfil.componentes.set(componentes_ids)
        
        return usuario
    
    def update(self, instance, validated_data):
        componentes_ids = validated_data.pop('componentes_ids', None)
        perfil_id = validated_data.pop('perfil_id', None)
        senha = validated_data.pop('senha', None)
        
        # Atualizar campos básicos
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        # Atualizar senha se fornecida
        if senha:
            instance.set_password(senha)
        
        # Atualizar perfil
        if perfil_id is not None:
            if perfil_id:
                try:
                    perfil = Perfil.objects.get(pk=perfil_id)
                    instance.perfil = perfil
                except Perfil.DoesNotExist:
                    pass
            else:
                instance.perfil = None
        
        instance.save()
        
        # Atualizar componentes
        if componentes_ids is not None:
            if not instance.perfil and componentes_ids:
                # Criar perfil se não existir e houver componentes
                perfil = Perfil.objects.create(nome=f"Perfil {instance.id}")
                instance.perfil = perfil
                instance.save(update_fields=['perfil'])
            
            if instance.perfil:
                instance.perfil.componentes.set(componentes_ids)
        
        return instance

